from typing import List, Dict, Any, Optional
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio

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

    async def expand_query(self, query: str) -> List[str]:
        """Generate related search terms using LLM."""
        prompt = f"""Given this research query, generate 8 related search terms that would help find relevant academic papers.
Return only a JSON array of strings, no explanation.

Query: "{query}"

Example output: ["term1", "term2", "term3", ...]"""
        
        try:
            response = await self.llm.generate_json(prompt)
            return response if isinstance(response, list) else []
        except Exception as e:
            print(f"Query expansion error: {e}")
            return []

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
        results = self.vector_store.query(query_embedding, n_results=limit)
        
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

    async def hybrid_search(self, db: AsyncSession, query: str, limit: int = 20) -> List[Dict]:
        """Full hybrid search pipeline."""
        # Expand query
        expanded_terms = await self.expand_query(query)
        all_queries = [query] + expanded_terms
        
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
        
        # Merge with unique papers and rerank
        all_candidates = unique_papers + fused
        final = await self.rerank_with_llm(query, all_candidates, limit)
        
        # Add relevance signals
        for i, paper in enumerate(final):
            paper["relevance"] = self._compute_relevance_signals(paper, query)
            paper["rank"] = i + 1
        
        return final

    def _compute_relevance_signals(self, paper: Dict, query: str) -> Dict:
        """Compute relevance signals for UI."""
        # Simplified heuristic signals
        title = paper.get("title", "").lower()
        abstract = (paper.get("abstract") or "").lower()
        query_terms = set(query.lower().split())
        
        title_matches = sum(1 for term in query_terms if term in title)
        abstract_matches = sum(1 for term in query_terms if term in abstract)
        
        return {
            "semanticMatch": "high" if title_matches > 1 else "medium" if title_matches > 0 else "low",
            "keywordMatch": "high" if abstract_matches > 3 else "medium" if abstract_matches > 0 else "low",
            "methodologyMatch": "unknown",
            "datasetMatch": "unknown",
            "recency": "high" if paper.get("year", 0) >= 2023 else "medium" if paper.get("year", 0) >= 2020 else "low",
            "citationInfluence": "unknown",
            "overallScore": min(100, 50 + title_matches * 10 + abstract_matches * 5),
        }


search_service = HybridSearchService()