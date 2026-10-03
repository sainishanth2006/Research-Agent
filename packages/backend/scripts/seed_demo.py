#!/usr/bin/env python3
"""Seed database with demo papers for hackathon - completely standalone."""
import asyncio
import sys
import os
import arxiv
import fitz  # pymupdf
import google.generativeai as genai
import chromadb

os.environ["DATABASE_URL"] = "postgresql://mrdu:mrdu@localhost:5432/mrdu"
os.environ["GEMINI_API_KEY"] = "test"

from prisma import Prisma


async def seed_demo_papers():
    # Initialize clients
    client = arxiv.Client()
    genai.configure(api_key=os.environ.get("GEMINI_API_KEY", "test"))
    
    # Initialize Chroma
    chroma_client = chromadb.HttpClient(host="localhost", port=8000)
    collection = chroma_client.get_or_create_collection("papers")
    
    prisma = Prisma()
    await prisma.connect()
    
    # Search for papers
    print("Searching arXiv...")
    search = arxiv.Search(
        query="adaptive learning recommendation system",
        max_results=10,
        sort_by=arxiv.SortCriterion.Relevance
    )
    
    papers = list(arxiv.Client().results(search))
    print(f"Found {len(papers)} papers")
    
    for i, paper in enumerate(papers[:5]):
        print(f"Processing paper {i+1}: {paper.title[:60]}...")
        
        arxiv_id = paper.entry_id.split("/")[-1]
        
        # Check if already exists
        existing = await prisma.paper.find_unique(where={"externalId": arxiv_id})
        if existing:
            print(f"  Already exists, skipping")
            continue
        
        # Create paper record
        new_paper = await prisma.paper.create(
            data={
                "externalId": arxiv_id,
                "source": "arxiv",
                "title": paper.title,
                "abstract": paper.summary,
                "authors": [author.name for author in paper.authors],
                "year": paper.published.year if paper.published else None,
                "venue": "arXiv",
                "doi": paper.doi,
                "url": paper.entry_id,
                "pdfUrl": paper.pdf_url,
                "citationCount": 0,
                "referenceCount": 0,
                "topics": paper.categories,
            }
        )
        print(f"  Created paper: {new_paper.id}")
        
        # Process content (use abstract for demo)
        content = paper.summary or "No abstract available"
        
        # Chunk the content
        words = content.split()
        chunk_size = 500
        chunk_overlap = 50
        chunks = []
        
        for i in range(0, len(words), 500 - 50):
            chunk_words = words[i:i + chunk_size]
            chunk_text = " ".join(chunk_words)
            if len(chunk_text.strip()) > 50:
                chunks.append({"content": chunk_text, "token_count": len(chunk_words)})
        
        # Generate embeddings using Gemini
        chunk_texts = [c["content"] for c in chunks]
        embeddings = []
        
        for j in range(0, len(chunk_texts), 10):
            batch = chunk_texts[j:j+10]
            try:
                result = await asyncio.to_thread(
                    genai.embed_content,
                    model="models/text-embedding-004",
                    content=batch,
                    task_type="retrieval_document"
                )
                embeddings.extend(result["embedding"])
            except Exception as e:
                print(f"  Embedding error: {e}")
                embeddings.extend([[0.0] * 768] * len(batch))
        
        # Store chunks in PostgreSQL and Chroma
        chroma_client = chromadb.HttpClient(host="localhost", port=8000)
        collection = chroma_client.get_or_create_collection("papers")
        
        for j, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            chroma_id = f"{prisma.paper.id}-chunk-{j}"
            
            # Store in Chroma
            collection.upsert(
                ids=[f"paper-chunk-{j}"],
                documents=[chunk["content"]],
                embeddings=[embedding],
                metadatas=[{"paper_id": prisma.paper.id, "chunk_index": j}]
            )
        
        print(f"  Processed {len(chunks)} chunks")
    
    print("Seeding complete!")


if __name__ == "__main__":
    import asyncio
    asyncio.run(seed_demo_papers())