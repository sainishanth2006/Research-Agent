from typing import List, Dict, Any
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.paper_analysis import paper_analysis_service


class ComparisonService:
    def __init__(self):
        self.analysis_service = paper_analysis_service

    async def compare_papers(self, db, paper_ids: List[str]) -> Dict[str, Any]:
        """Compare multiple papers across key dimensions."""
        if not paper_ids or len(paper_ids) < 2:
            return {"papers": [], "rows": []}
        
        # Get basic paper info
        papers = []
        for pid in paper_ids:
            # In production, fetch from DB
            # For now, return minimal info
            papers.append({"id": pid})
        
        # Get analyses for each paper
        analyses = {}
        for pid in paper_ids:
            try:
                analysis = await self.analysis_service.analyze_paper(pid)
                analyses[pid] = analysis
            except Exception as e:
                print(f"Analysis error for {pid}: {e}")
                analyses[pid] = {}
        
        # Create comparison rows
        rows = []
        dimensions = [
            ("researchProblem", "Research Problem"),
            ("methodology", "Methodology"),
            ("dataset", "Dataset"),
            ("experiments", "Experiments"),
            ("metrics", "Metrics"),
            ("keyFindings", "Key Findings"),
            ("contributions", "Contributions"),
            ("limitations", "Limitations"),
            ("futureWork", "Future Work"),
        ]
        
        for field_key, label in dimensions:
            row = {"feature": label, "values": {}}
            for pid in paper_ids:
                analysis = analyses.get(pid, {})
                value = analysis.get(field_key, {})
                row["values"][pid] = value if value else {"text": "Not available", "citations": []}
            rows.append(row)
        
        return {
            "papers": papers,
            "rows": rows,
        }


comparison_service = ComparisonService()