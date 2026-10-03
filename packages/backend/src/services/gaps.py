from typing import List, Dict, Any
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.llm import llm_service


class GapsService:
    def __init__(self):
        self.llm = llm_service

    async def identify_gaps(self, db, paper_ids: List[str]) -> List[Dict]:
        """Identify potential research gaps from a set of papers."""
        # For now, use a simplified approach
        # In production, this would analyze paper content more deeply
        
        gaps = [
            {
                "id": "gap-1",
                "title": "Limited Cross-Domain Evaluation",
                "description": {
                    "text": "Most papers evaluate on single domains. There's a need for systematic cross-domain evaluation frameworks.",
                    "citations": [],
                },
                "supporting_papers": paper_ids[:2],
                "confidence": "medium",
                "category": "evaluation",
            },
            {
                "id": "gap-2",
                "title": "Lack of Real-World Deployment Studies",
                "description": {
                    "text": "Few papers address real-world deployment challenges like concept drift, monitoring, and A/B testing.",
                    "citations": [],
                },
                "supporting_papers": paper_ids[2:4] if len(paper_ids) > 2 else paper_ids,
                "confidence": "high",
                "category": "application",
            },
            {
                "id": "gap-3",
                "title": "Limited Theoretical Analysis of Adaptive Methods",
                "description": {
                    "text": "While many adaptive methods are proposed empirically, theoretical guarantees are often lacking.",
                    "citations": [],
                },
                "supporting_papers": paper_ids[:3],
                "confidence": "medium",
                "category": "theoretical",
            },
        ]
        
        return gaps

    async def identify_gaps_from_search(self, db, query: str, paper_ids: List[str]) -> List[Dict]:
        """Identify gaps based on search query and retrieved papers."""
        # Use LLM to generate more relevant gaps
        prompt = f"""Given these paper IDs on the topic "{query}", identify 3 potential research gaps.
Paper IDs: {paper_ids}

Return JSON array of gaps with: id, title, description (with text and citations), supporting_papers (subset of IDs), confidence (high/medium/low), category (methodology/dataset/evaluation/application/theoretical)."""
        
        try:
            result = await self.llm.generate_json(prompt)
            if isinstance(result, list):
                return result
        except Exception as e:
            print(f"Gap identification error: {e}")
        
        return await self.identify_gaps(db, paper_ids)


gaps_service = GapsService()