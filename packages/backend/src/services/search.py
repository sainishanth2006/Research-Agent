from typing import List, Dict, Any, Optional
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio
import re

from src.services.arxiv import arxiv_fetcher
from src.services.embeddings import embedding_service
from src.services.vector_store import vector_store
from src.services.llm import llm_service
from src.config import settings


class HybridSearchService:
    def __init__(self):
        self.arxiv = arxiv_fetcher
        self.embeddings = embedding_service
        self.vector_store = vector_store
        self.llm = llm_service

    def _fallback_expansion_terms(self, query: str) -> List[str]:
        """Generate a quick heuristic expansion when the LLM is unavailable."""
        if not query or not query.strip():
            return []

        cleaned = re.sub(r"[^a-zA-Z0-9\s-]", " ", query.lower())
        tokens = [t for t in cleaned.split() if len(t) > 2]
        keywords = []
        for token in tokens:
            token = token.strip('-')
            if token and token not in {"the", "with", "using", "from", "into", "about", "for"}:
                keywords.append(token)

        if not keywords:
            return [query.strip()]

        expansions = []
        for token in keywords[:6]:
            expansions.append(token)
            expansions.append(f"{token} model")
            expansions.append(f"{token} methods")
            expansions.append(f"{token} dataset")

        # keep results unique and relevant
        unique = []
        seen = set()
        for term in expansions:
            normalized = " ".join(term.split())
            if normalized and normalized not in seen:
                seen.add(normalized)
                unique.append(normalized)
        return unique[:8]

    async def expand_query(self, query: str) -> List[str]:
        """Generate related search terms using LLM with a safe fallback."""
        prompt = f"""Given this research query, generate 8 related search terms that would help find relevant academic papers.
Return only a JSON array of strings, no explanation.

Query: "{query}"

Example output: ["term1", "term2", "term3", ...]"""

        try:
            if not settings.gemini_api_key:
                return self._fallback_expansion_terms(query)

            response = await self.llm.generate_json(prompt)
            if isinstance(response, list) and response:
                return [str(term).strip() for term in response if str(term).strip()]
            return self._fallback_expansion_terms(query)
        except Exception as e:
            print(f"Query expansion error: {e}")
            return self._fallback_expansion_terms(query)

    async def search_arxiv(self, query: str, limit: int = 20) -> List[Dict]:
        """Search arXiv and return normalized papers."""
        papers = await self.arxiv.search(query, max_results=limit)
        return papers

    async def bm25_search(self, db: AsyncSession, query: str, limit: int = 20) -> List[Dict]:
        """BM25 search using PostgreSQL full-text search."""
        # Simple tsquery approach
        ts_query = " & ".join(query.split()[:10])  # Limit terms
        sql = text("""
            SELECT p.*, 
                   ts_rank_cd(to_tsvector('english', p.title || ' ' || COALESCE(p.abstract, '')), 
                              plainto_tsquery('english', :query)) as rank
            FROM "Paper" p
            WHERE to_tsvector('english', p.title || ' ' || COALESCE(p.abstract, '')) @@ plainto_tsquery('english', :query)
            ORDER BY rank DESC
            LIMIT :limit
        """)
        result = await db.execute(sql, {"query": query, "limit": limit})
        papers = []
        for row in result.mappings():
            papers.append(dict(row))
        return papers

    async def vector_search(self, query: str, limit: int = 20) -> List[Dict]:
        """Vector similarity search via Chroma."""
        query_embedding = await self.embeddings.embed_query(query)
        if not query_embedding or not any(query_embedding):
            return []
        try:
            results = await asyncio.wait_for(
                asyncio.to_thread(
                    self.vector_store.query,
                    query_embedding,
                    limit,
                ),
                timeout=10,
            )
        except Exception as e:
            print(f"Vector search error: {e}")
            return []
        
        papers = []
        if results["ids"] and results["ids"][0]:
            for i, chunk_id in enumerate(results["ids"][0]):
                metadata = results["metadatas"][0][i]
                distance = results["distances"][0][i]
                papers.append({
                    "paper_id": metadata["paper_id"],
                    "chunk_id": chunk_id,
                    "content": results["documents"][0][i],
                    "similarity": 1 - distance,
                })
        return papers

    async def reciprocal_rank_fusion(self, bm25_results: List, vector_results: List, 
                                      k: int = 60) -> List[Dict]:
        """Combine BM25 and vector results using RRF."""
        scores = {}
        
        # BM25 ranks
        for rank, paper in enumerate(bm25_results):
            pid = paper.get("id") or paper.get("external_id")
            if pid:
                scores.setdefault(pid, {"paper": paper, "score": 0})
                scores[pid]["score"] += 1 / (k + rank + 1)
        
        # Vector ranks
        for rank, result in enumerate(vector_results):
            pid = result.get("paper_id")
            if pid:
                scores.setdefault(pid, {"paper": {"id": pid}, "score": 0})
                scores[pid]["score"] += 1 / (k + rank + 1)
        
        # Sort by combined score
        fused = sorted(scores.values(), key=lambda x: x["score"], reverse=True)
        return [item["paper"] for item in fused]

    async def rerank_with_llm(self, query: str, papers: List[Dict], limit: int = 10) -> List[Dict]:
        """Rerank papers using LLM for relevance."""
        if not papers:
            return []
        
        # Prepare paper summaries for LLM
        paper_summaries = []
        for i, p in enumerate(papers[:20]):  # Limit to top 20 for reranking
            paper_summaries.append({
                "index": i,
                "title": p.get("title", ""),
                "abstract": p.get("abstract", "")[:500],
                "year": p.get("year"),
                "venue": p.get("venue"),
            })
        
        prompt = f"""Rank these papers by relevance to the research query.
Return only a JSON array of indices (0-based) in order of relevance.

Query: "{query}"

Papers:
{chr(10).join(f'{i}: {p["title"]} ({p["year"]}) - {p["abstract"][:200]}...' for i, p in enumerate(paper_summaries))}"""
        
        try:
            ranked_indices = await self.llm.generate_json(prompt)
            if isinstance(ranked_indices, list):
                reranked = [papers[i] for i in ranked_indices if i < len(papers)]
                # Add remaining papers
                seen = set(ranked_indices)
                for i, p in enumerate(papers):
                    if i not in seen:
                        reranked.append(p)
                return reranked[:limit]
        except Exception as e:
            print(f"Reranking error: {e}")
        
        return papers[:limit]

    async def hybrid_search(
        self,
        db: AsyncSession,
        query: str,
        limit: int = 20,
        expanded_terms: Optional[List[str]] = None,
    ) -> List[Dict]:
        """Full hybrid search pipeline."""
        # Reuse concepts generated for the uploaded paper when provided. This
        # keeps retrieval grounded in the source paper instead of generating a
        # second, potentially unrelated expansion.
        expanded_terms = expanded_terms or await self.expand_query(query)
        # Keep the live search bounded even when expansion returns many terms.
        all_queries = [query] + [
            term for term in expanded_terms
            if term.strip() and term.strip().lower() != query.strip().lower()
        ][:2]
        
        # Search expanded queries concurrently so one slow provider call does not
        # block the entire research workflow.
        search_results = await asyncio.gather(
            *(self.search_arxiv(q, limit=limit) for q in all_queries),
            return_exceptions=True,
        )
        all_papers = []
        for result in search_results:
            if isinstance(result, Exception):
                print(f"arXiv search error: {result}")
                continue
            all_papers.extend(result)
        
        # Deduplicate by external_id
        seen = set()
        unique_papers = []
        for p in all_papers:
            eid = p.get("external_id")
            if eid and eid not in seen:
                seen.add(eid)
                unique_papers.append(p)
        
        # BM25 search on existing papers
        bm25_papers = await self.bm25_search(db, query, limit)
        
        # Vector search
        vector_results = await self.vector_search(query, limit)
        
        # RRF fusion
        fused = await self.reciprocal_rank_fusion(bm25_papers, vector_results)
        
        # Merge with unique papers and rerank. Prefer candidates that share
        # meaningful terms with the source paper before asking the LLM to
        # resolve semantic matches.
        all_candidates = self._rank_candidates_by_overlap(
            unique_papers + fused,
            query,
            expanded_terms,
        )
        try:
            final = await asyncio.wait_for(
                self.rerank_with_llm(
                    self._build_relevance_query(query, expanded_terms),
                    all_candidates[: max(limit * 2, 20)],
                    limit,
                ),
                timeout=8,
            )
        except asyncio.TimeoutError:
            print("Reranking timed out; returning search results without LLM reranking")
            final = all_candidates[:limit]
        
        # Add relevance signals
        for i, paper in enumerate(final):
            paper["relevance"] = self._compute_relevance_signals(paper, query)
            paper["rank"] = i + 1
        
        return final

    def _build_relevance_query(self, query: str, expanded_terms: List[str]) -> str:
        """Build a bounded query containing the source paper's key concepts."""
        terms = [term.strip() for term in expanded_terms if term.strip()]
        return " ".join([query[:3000], *terms[:8]])

    def _rank_candidates_by_overlap(
        self,
        papers: List[Dict],
        query: str,
        expanded_terms: List[str],
    ) -> List[Dict]:
        """Put candidates with source-paper concept overlap ahead of noise."""
        source_text = " ".join([query, *expanded_terms]).lower()
        source_tokens = self._meaningful_tokens(source_text)
        if not source_tokens:
            return papers

        scored = []
        for index, paper in enumerate(papers):
            candidate_text = " ".join([
                str(paper.get("title") or ""),
                str(paper.get("abstract") or ""),
                " ".join(str(topic) for topic in (paper.get("topics") or [])),
            ]).lower()
            candidate_tokens = self._meaningful_tokens(candidate_text)
            overlap = source_tokens & candidate_tokens
            title_tokens = self._meaningful_tokens(str(paper.get("title") or "").lower())
            title_overlap = source_tokens & title_tokens
            score = len(overlap) + (2 * len(title_overlap))
            scored.append((score, -index, paper))

        scored.sort(reverse=True, key=lambda item: (item[0], item[1]))
        relevant = [paper for score, _, paper in scored if score > 0]
        # If lexical overlap is unavailable for every candidate, retain the
        # semantic candidates and let the LLM reranker make the decision.
        return relevant or [paper for _, _, paper in scored]

    @staticmethod
    def _meaningful_tokens(text: str) -> set[str]:
        stop_words = {
            "about", "after", "also", "been", "between", "could", "from",
            "have", "into", "more", "paper", "research", "that", "their",
            "these", "they", "this", "using", "with", "within", "would",
            "approach", "based", "dataset", "method", "model", "results",
        }
        return {
            token for token in re.findall(r"[a-z0-9]{3,}", text)
            if token not in stop_words
        }

    def _compute_relevance_signals(self, paper: Dict, query: str) -> Dict:
        """Compute relevance signals for UI."""
        # Simplified heuristic signals
        title = paper.get("title", "").lower()
        abstract = (paper.get("abstract") or "").lower()
        query_terms = set(query.lower().split())
        
        title_matches = sum(1 for term in query_terms if term in title)
        abstract_matches = sum(1 for term in query_terms if term in abstract)
        
        year = paper.get("year")
        recency = "high" if isinstance(year, int) and year >= 2023 else "medium" if isinstance(year, int) and year >= 2020 else "low"
        return {
            "semanticMatch": "high" if title_matches > 1 else "medium" if title_matches > 0 else "low",
            "keywordMatch": "high" if abstract_matches > 3 else "medium" if abstract_matches > 0 else "low",
            "methodologyMatch": "unknown",
            "datasetMatch": "unknown",
            "recency": recency,
            "citationInfluence": "unknown",
            "overallScore": min(100, 50 + title_matches * 10 + abstract_matches * 5),
        }


search_service = HybridSearchService()