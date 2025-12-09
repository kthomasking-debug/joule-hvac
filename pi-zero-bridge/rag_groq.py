#!/usr/bin/env python3
"""
Joule Groq-Powered RAG Pipeline
Lightweight: Local embeddings + Groq API inference
Optimized for Raspberry Pi Zero 2 W (512MB RAM)
"""

import os
import sys
import json
from pathlib import Path

# LangChain imports
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain_community.vectorstores import Chroma
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate

# Configuration
DOCS_DIR = Path(__file__).parent / "docs"
RAG_DB_DIR = Path(__file__).parent / "rag_db"
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"  # Lightweight, ~100MB
GROQ_MODEL = "llama-3.2-3b-versatile"  # Fast, free tier friendly
CHUNK_SIZE = 500  # Smaller chunks for 512MB RAM
CHUNK_OVERLAP = 50

# System prompt matching Joule's style
SYSTEM_PROMPT = """You are Joule, an HVAC analytics engine. Be concise. Do not use filler phrases like 'Sure thing,' 'Certainly,' 'Here is the answer,' 'Great question,' or 'Let me break that down.' Start directly with the data or the solution.

STYLE GUIDE:
- Length: Maximum 3 sentences per concept. Total response under 100 words unless asked for a deep dive.
- Format: Use bullet points for lists. No intro fluff. No outro fluff.
- Tone: Direct, technical, authoritative. Like a senior engineer speaking to a junior engineer.
- If you cite a number, just cite it. Don't narrate the citation.

Use the following context to answer the question. If the context doesn't contain the answer, say so directly without apologizing.

Context: {context}

Question: {question}

Answer:"""

def get_embeddings():
    """Get lightweight embedding model"""
    return HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL,
        model_kwargs={'device': 'cpu'}  # Pi Zero doesn't have GPU
    )

def ingest_documents():
    """Ingest documents into vector database"""
    print("📚 Loading documents...")
    
    # Load all text files
    loader = DirectoryLoader(
        str(DOCS_DIR),
        glob="**/*.txt",
        loader_cls=TextLoader,
        loader_kwargs={'encoding': 'utf-8'}
    )
    
    try:
        docs = loader.load()
    except Exception as e:
        print(f"⚠️  Error loading documents: {e}")
        docs = []
    
    if not docs:
        print("⚠️  No documents found. Place .txt files in docs/ directory.")
        return False
    
    print(f"📄 Loaded {len(docs)} documents")
    
    # Split documents
    print("✂️  Splitting documents...")
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP
    )
    splits = splitter.split_documents(docs)
    print(f"📦 Created {len(splits)} chunks")
    
    # Create embeddings and vector store
    print("🔢 Creating embeddings (this may take a few minutes)...")
    embeddings = get_embeddings()
    
    print("💾 Saving to vector database...")
    vectorstore = Chroma.from_documents(
        splits,
        embeddings,
        persist_directory=str(RAG_DB_DIR)
    )
    
    print(f"✅ Ingested {len(splits)} chunks into vector database")
    print(f"💾 Database size: ~{sum(f.stat().st_size for f in RAG_DB_DIR.rglob('*') if f.is_file()) / 1024 / 1024:.1f} MB")
    return True

def query_rag(question, user_context=None):
    """Query RAG system with Groq"""
    groq_api_key = os.getenv('GROQ_API_KEY')
    if not groq_api_key:
        return "Error: GROQ_API_KEY environment variable not set"
    
    # Load existing vector store
    if not (RAG_DB_DIR / "chroma.sqlite3").exists():
        return "Error: No vector database found. Run ingestion first."
    
    print("🔍 Loading vector database...")
    embeddings = get_embeddings()
    vectorstore = Chroma(
        persist_directory=str(RAG_DB_DIR),
        embedding_function=embeddings
    )
    
    # Initialize Groq LLM
    print("🤖 Initializing Groq LLM...")
    llm = ChatGroq(
        model=GROQ_MODEL,
        temperature=0.7,
        groq_api_key=groq_api_key
    )
    
    # Create prompt template
    prompt = PromptTemplate(
        template=SYSTEM_PROMPT,
        input_variables=["context", "question"]
    )
    
    # Create retrieval chain
    print("🔗 Creating retrieval chain...")
    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=vectorstore.as_retriever(search_kwargs={"k": 3}),  # Top 3 chunks
        return_source_documents=False,
        chain_type_kwargs={"prompt": prompt}
    )
    
    # Add user context to question if provided
    if user_context:
        try:
            ctx = json.loads(user_context)
            if ctx.get('userSettings'):
                question += f"\n\nUser Settings: {json.dumps(ctx['userSettings'], indent=2)}"
            if ctx.get('userLocation'):
                question += f"\n\nUser Location: {json.dumps(ctx['userLocation'], indent=2)}"
        except:
            pass
    
    print(f"❓ Querying: {question[:50]}...")
    result = qa_chain.run(question)
    
    return result

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python rag_groq.py ingest          # Ingest documents")
        print("  python rag_groq.py query <question> [context_json]  # Query RAG")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "ingest":
        success = ingest_documents()
        sys.exit(0 if success else 1)
    
    elif command == "query":
        if len(sys.argv) < 3:
            print("Error: Question required")
            sys.exit(1)
        
        question = sys.argv[2]
        context = sys.argv[3] if len(sys.argv) > 3 else None
        
        result = query_rag(question, context)
        print(result)
        sys.exit(0)
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)






