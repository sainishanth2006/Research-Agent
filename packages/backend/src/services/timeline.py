from typing import List, Dict, Any
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.embeddings import embedding_service
from src.services.vector_store import vector_store


class TimelineService:
    def __init__(self):
        self.embeddings = embedding_service
        self.vector_store = vector_store

    async def get_before_after(self, db: AsyncSession, paper_id: str, paper_year: int, 
                               paper_abstract: str, limit: int = 10) -> Dict[str, List[Dict]]:
        """Find papers before and after the given paper."""
        # Get similar papers from vector store
        query_embedding = await embedding_service.embed_query(paper_abstract)
        results = self.vector_store.query(query_embedding, n_results=50)
        
        papers = []
        if results["ids"] and results["ids"][0]:
            for i, chunk_id in enumerate(results["ids"][0]):
                metadata = results["metadatas"][0][i]
                pid = metadata["paper_id"]
                if pid != paper_id and pid not in [p["id"] for p in papers]:
                    papers.append({"id": pid})
        
        # Get full paper details from DB
        before_papers = []
        after_papers = []
        
        for p in papers[:20]:  # Limit to 20 candidates
            result = await db.execute(
                text("SELECT id, external_id, source, title, abstract, authors, year, venue, doi, url, pdf_url, citation_count, reference_count, topics FROM \"Paper\" WHERE id = :pid"),
                {"pid": p["id"]}
            )
            row = result.mappings().first()
            if row:
                paper_dict = dict(row)
                if paper_dict["year"] and paper_dict["year"] < paper_year:
                    before_papers.append(paper_dict)
                elif paper_dict["year"] and paper_dict["year"] > paper_year:
                    after_papers.append(paper_dict)
        
        # Sort by year
        before_papers.sort(key=lambda x: x["year"] or 0, reverse=True)
        after_papers.sort(key=lambda x: x["year"] or 0)
        
        return {
            "before": before_papers[:limit],
            "after": after_papers[:limit],
        }

    async def get_evolution_timeline(self, db: AsyncSession, topic: str, 
                                     limit_per_year: int = 3) -> List[Dict]:
        """Get research evolution timeline for a topic."""
        # Search for papers on this topic
        from src.services.arxiv import arxiv_fetcher
        papers = await arxiv_fetcher.search(topic, max_results=100)
        
        # Group by year
        year_groups = {}
        for p in papers:
            year = p.get("year") or 0
            if year >= 2015:  # Only recent years
                year_groups.setdefault(year, []).append(p)
        
        # Create timeline entries
        timeline = []
        for year in sorted(year_groups.keys()):
            year_papers = year_groups[year][:limit_per_year]
            phase = self._get_phase_label(year, year_papers)
            
            timeline.append({
                "year": year,
                "papers": year_papers,
                "phase": phase,
                "summary": self._generate_phase_summary(year_papers),
            })
        
        return timeline

    def _get_phase_label(self, year: int, papers: List[Dict]) -> str:
        """Generate phase label for a year."""
        topics = []
        for p in papers:
            topics.extend(p.get("topics", []))
        
        if "transformer" in str(topics).lower():
            return f"{year}: Transformer Era"
        elif "continual" in str(topics).lower() or "lifelong" in str(topics).lower():
            return f"{year}: Continual Learning"
        elif "graph" in str(topics).lower():
            return f"{year}: Graph Neural Networks"
        elif "reinforcement" in str(topics).lower():
            return f"{year}: Reinforcement Learning"
        else:
            return f"{year}: {len(papers)} papers"

    def _generate_phase_summary(self, papers: List[Dict]) -> str:
        """Generate summary for a phase."""
        if not papers:
            return ""
        titles = [p.get("title", "") for p in papers[:3]]
        return f"Key work: {'; '.join(titles)}"


timeline_service = TimelineService()