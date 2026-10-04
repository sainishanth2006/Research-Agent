from typing import Dict, List, Any
import json
import asyncio

from src.services.llm import llm_service
from src.services.vector_store import vector_store


class PaperAnalysisService:
    def __init__(self):
        self.llm = llm_service

    async def analyze_paper(self, paper_id: str, paper_context: Dict | None = None) -> Dict:
        """Extract structured analysis from paper chunks."""
        # Get chunks from vector store
        try:
            chunks = vector_store.get_chunks(paper_id)
        except Exception as e:
            print(f"Chunk retrieval error: {e}")
            chunks = []
        if not chunks:
            return self._analysis_from_metadata(paper_context)
        
        # Combine chunks for analysis (limit tokens)
        full_text = "\n\n".join([c["content"] for c in chunks[:20]])
        
        schema = {
            "type": "object",
            "properties": {
                "researchProblem": {"type": "object", "properties": {"text": {"type": "string"}, "citations": {"type": "array", "items": {"type": "object"}}}},
                "methodology": {"type": "object", "properties": {"text": {"type": "string"}, "citations": {"type": "array", "items": {"type": "object"}}}},
                "dataset": {"type": "object", "properties": {"text": {"type": "string"}, "citations": {"type": "array", "items": {"type": "object"}}}},
                "experiments": {"type": "object", "properties": {"text": {"type": "string"}, "citations": {"type": "array", "items": {"type": "object"}}}},
                "metrics": {"type": "object", "properties": {"text": {"type": "string"}, "citations": {"type": "array", "items": {"type": "object"}}}},
                "keyFindings": {"type": "array", "items": {"type": "object", "properties": {"text": {"type": "string"}, "citations": {"type": "array", "items": {"type": "object"}}}}},
                "contributions": {"type": "array", "items": {"type": "object", "properties": {"text": {"type": "string"}, "citations": {"type": "array", "items": {"type": "object"}}}}},
                "limitations": {"type": "array", "items": {"type": "object", "properties": {"text": {"type": "string"}, "citations": {"type": "array", "items": {"type": "object"}}}}},
                "futureWork": {"type": "array", "items": {"type": "object", "properties": {"text": {"type": "string"}, "citations": {"type": "array", "items": {"type": "object"}}}}},
            }
        }
        
        prompt = f"""Analyze this research paper and extract structured information.
For each field, provide the extracted text and cite relevant chunk indices (0-based).

Paper text:
{full_text[:15000]}"""
        
        try:
            result = await self.llm.generate_structured(prompt, schema, model="pro")
            return self._format_analysis(result, chunks)
        except Exception as e:
            print(f"Analysis error: {e}")
            return self._analysis_from_metadata(paper_context)

    def _analysis_from_metadata(self, paper_context: Dict | None) -> Dict:
        """Provide useful analysis for papers whose full text is not indexed."""
        abstract = (paper_context or {}).get("abstract") or ""
        if not abstract:
            return self._empty_analysis()

        title = (paper_context or {}).get("title") or "This paper"
        return {
            "paperId": "",
            "researchProblem": {
                "text": f"{title} describes the following research focus:\n\n{abstract}",
                "citations": [],
            },
            "methodology": {
                "text": "The full paper text has not been indexed yet. Open the PDF or upload the paper to enable detailed methodology extraction.",
                "citations": [],
            },
            "dataset": {
                "text": "Dataset details are not available in the stored metadata and abstract.",
                "citations": [],
            },
            "experiments": {
                "text": "Experimental details are not available in the stored metadata and abstract.",
                "citations": [],
            },
            "metrics": {
                "text": "Evaluation metrics are not available in the stored metadata and abstract.",
                "citations": [],
            },
            "keyFindings": [{
                "text": abstract,
                "citations": [],
            }],
            "contributions": [{
                "text": "The abstract is available, but detailed contribution extraction requires the indexed full text.",
                "citations": [],
            }],
            "limitations": [{
                "text": "The available metadata does not contain enough information to identify the paper's limitations reliably.",
                "citations": [],
            }],
            "futureWork": [{
                "text": "Upload or index the full paper to extract the authors' proposed future work.",
                "citations": [],
            }],
        }

    def _format_analysis(self, result: Dict, chunks: List) -> Dict:
        """Format analysis with proper citation structure."""
        def make_cited(field_data):
            if not field_data:
                return {"text": "Information unavailable.", "citations": []}
            text = field_data.get("text", "") if isinstance(field_data, dict) else str(field_data)
            citations = field_data.get("citations", []) if isinstance(field_data, dict) else []
            return {
                "text": text,
                "citations": [{"chunk_index": c, "paper_id": ""} for c in citations] if isinstance(citations, list) else []
            }
        
        def make_cited_list(items):
            if not items:
                return []
            if isinstance(items[0], str):
                return [{"text": item, "citations": []} for item in items]
            return [{"text": item.get("text", ""), "citations": [{"chunk_index": c, "paper_id": ""} for c in item.get("citations", [])]} for item in items]
        
        return {
            "paperId": "",
            "researchProblem": make_cited(result.get("researchProblem")),
            "methodology": make_cited(result.get("methodology")),
            "dataset": make_cited(result.get("dataset")),
            "experiments": make_cited(result.get("experiments")),
            "metrics": make_cited(result.get("metrics")),
            "keyFindings": make_cited_list(result.get("keyFindings", [])),
            "contributions": make_cited_list(result.get("contributions", [])),
            "limitations": make_cited_list(result.get("limitations", [])),
            "futureWork": make_cited_list(result.get("futureWork", [])),
        }

    def _empty_analysis(self) -> Dict:
        empty = {"text": "Information unavailable.", "citations": []}
        return {
            "paperId": "",
            "researchProblem": empty,
            "methodology": empty,
            "dataset": empty,
            "experiments": empty,
            "metrics": empty,
            "keyFindings": [],
            "contributions": [],
            "limitations": [],
            "futureWork": [],
        }

    async def answer_question(self, paper_id: str, question: str, paper_context: Dict | None = None) -> Dict:
        """Answer a question about a specific paper using RAG."""
        try:
            chunks = vector_store.get_chunks(paper_id)
        except Exception as e:
            print(f"Chunk retrieval error: {e}")
            chunks = []
        if not chunks:
            abstract = (paper_context or {}).get("abstract") or ""
            if not abstract:
                return {"answer": "Paper content is not available yet. Open the PDF or upload it to ask questions.", "citations": []}
            try:
                answer = await self.llm.generate(
                    f"""Answer the question using only this paper abstract.
If the abstract does not contain the answer, say that it is not available.

Paper abstract:
{abstract}

Question: {question}""",
                    model="flash",
                )
                return {"answer": answer, "citations": []}
            except Exception as e:
                print(f"Metadata Q&A error: {e}")
                return {"answer": "The paper abstract is available, but the assistant could not answer right now.", "citations": []}
        
        # Retrieve top relevant chunks
        from src.services.embeddings import embedding_service
        try:
            query_embedding = await embedding_service.embed_query(question)
            results = vector_store.query(query_embedding, n_results=5, where={"paper_id": paper_id})
            documents = results["documents"][0]
            metadatas = results["metadatas"][0]
        except Exception as e:
            print(f"Vector Q&A unavailable, using uploaded paper chunks: {e}")
            documents = [chunk["content"] for chunk in chunks[:5]]
            metadatas = [{"chunk_index": chunk["chunk_index"]} for chunk in chunks[:5]]

        context = "\n\n".join(documents)
        
        prompt = f"""Answer the question based only on the provided paper content.
If the answer is not in the content, say "Information unavailable."

Paper content:
{context}

Question: {question}"""
        
        answer = await self.llm.generate(prompt, model="flash")
        
        return {
            "answer": answer,
            "citations": [{"chunk_index": metadata["chunk_index"], "paper_id": paper_id}
                          for metadata in metadatas],
        }


paper_analysis_service = PaperAnalysisService()