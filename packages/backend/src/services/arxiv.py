import arxiv
from typing import List, Optional
import asyncio
from concurrent.futures import ThreadPoolExecutor

from src.config import settings


class ArxivFetcher:
    def __init__(self):
        self.client = arxiv.Client(
            page_size=20,
            num_retries=0,
            delay_seconds=0,
        )
        self.executor = ThreadPoolExecutor(max_workers=4)

    async def search(self, query: str, max_results: int = 50) -> List[dict]:
        """Search arXiv for papers matching query."""
        search = arxiv.Search(
            query=query,
            max_results=max_results,
            sort_by=arxiv.SortCriterion.Relevance
        )
        
        loop = asyncio.get_event_loop()
        results = await asyncio.wait_for(
            loop.run_in_executor(
                self.executor,
                lambda: list(self.client.results(search))
            ),
            timeout=8,
        )
        results = results[:max_results]
        
        papers = []
        for paper in results:
            papers.append({
                "external_id": paper.entry_id.split("/")[-1],
                "source": "arxiv",
                "title": paper.title,
                "abstract": paper.summary,
                "authors": [author.name for author in paper.authors],
                "year": paper.published.year if paper.published else None,
                "venue": "arXiv",
                "doi": paper.doi,
                "url": paper.entry_id,
                "pdf_url": paper.pdf_url,
                "citation_count": 0,
                "reference_count": 0,
                "topics": paper.categories,
            })
        return papers

    async def fetch_paper(self, arxiv_id: str) -> Optional[dict]:
        """Fetch a single paper by arXiv ID."""
        search = arxiv.Search(id_list=[arxiv_id])
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(
            self.executor,
            lambda: list(self.client.results(search))
        )
        if not results:
            return None
        paper = results[0]
        return {
            "external_id": paper.entry_id.split("/")[-1],
            "source": "arxiv",
            "title": paper.title,
            "abstract": paper.summary,
            "authors": [author.name for author in paper.authors],
            "year": paper.published.year if paper.published else None,
            "venue": "arXiv",
            "doi": paper.doi,
            "url": paper.entry_id,
            "pdf_url": paper.pdf_url,
            "citation_count": 0,
            "reference_count": 0,
            "topics": paper.categories,
        }


arxiv_fetcher = ArxivFetcher()