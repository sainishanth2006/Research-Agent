from typing import List, Dict, Any
from sqlalchemy import text

from src.services.paper_analysis import paper_analysis_service


class ComparisonService:
    def __init__(self):
        self.analysis_service = paper_analysis_service

    async def compare_papers(self, db, paper_ids: List[str]) -> Dict[str, Any]:
        """Compare multiple papers across key dimensions."""
        if not paper_ids or len(paper_ids) < 2:
            return {"papers": [], "rows": []}
        
        papers = []
        analyses = {}
        for pid in paper_ids:
            result = await db.execute(
                text(
                    """
                    SELECT id, "externalId" AS external_id, title, abstract, authors,
                           year, venue, url, "pdfUrl" AS pdf_url
                    FROM "Paper"
                    WHERE id = :paper_id OR "externalId" = :paper_id
                    LIMIT 1
                    """
                ),
                {"paper_id": pid},
            )
            paper_row = result.mappings().first()
            if not paper_row:
                continue
            paper = dict(paper_row)
            papers.append(paper)
            try:
                analysis = await self.analysis_service.analyze_paper(
                    paper["id"],
                    {
                        "id": paper["id"],
                        "external_id": paper["external_id"],
                        "title": paper["title"],
                        "abstract": paper["abstract"],
                    },
                )
                analyses[paper["id"]] = analysis
            except Exception as e:
                print(f"Analysis error for {paper['id']}: {e}")
                analyses[paper["id"]] = {}

        if len(papers) < 2:
            return {"papers": papers, "rows": [], "error": "At least 2 selected papers could not be found."}
        
        # Create comparison rows
        rows = []
        dimensions = [
            ("researchProblem", "Research Problem"),
            ("methodology", "Methodology"),
            ("dataset", "Dataset"),
            ("experiments", "Experiments"),
            ("metrics", "Metrics"),
        ]
        
        for field_key, label in dimensions:
            row = {"feature": label, "values": {}}
            for paper in papers:
                paper_id = paper["id"]
                analysis = analyses.get(paper_id, {})
                value = analysis.get(field_key, {})
                row["values"][paper_id] = value if value else {"text": "Not available", "citations": []}
            rows.append(row)
        
        return {
            "papers": papers,
            "rows": rows,
        }


comparison_service = ComparisonService()