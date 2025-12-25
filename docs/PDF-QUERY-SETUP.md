# How to Query PDFs (Like Ecobee Manual)

This guide shows you how to add PDF support to your RAG system so you can ask questions about PDF documents like the full Ecobee manual.

## Overview

Your RAG system currently only handles `.txt` files. To query PDFs, you need to:

1. **Extract text from PDFs** (using a PDF library)
2. **Add PDF loader to RAG pipeline**
3. **Ingest PDFs into vector database**
4. **Query like normal**

## Option 1: Update Existing RAG Script (Recommended)

### Step 1: Install PDF Library

```bash
cd pi-zero-bridge
pip install pypdf2
# or
pip install pdfplumber  # Better for complex PDFs
```

### Step 2: Update `rag_groq.py`

Add PDF loader support:

```python
# Add to imports
from langchain_community.document_loaders import PyPDFLoader, DirectoryLoader

# Update ingest_documents() function
def ingest_documents():
    """Ingest documents into vector database"""
    print("📚 Loading documents...")
    
    # Load text files
    text_loader = DirectoryLoader(
        str(DOCS_DIR),
        glob="**/*.txt",
        loader_cls=TextLoader,
        loader_kwargs={'encoding': 'utf-8'}
    )
    
    # Load PDF files
    pdf_loader = DirectoryLoader(
        str(DOCS_DIR),
        glob="**/*.pdf",
        loader_cls=PyPDFLoader
    )
    
    # Combine all documents
    text_docs = text_loader.load()
    pdf_docs = pdf_loader.load()
    docs = text_docs + pdf_docs
    
    # Rest of the function stays the same...
```

### Step 3: Add PDF to Knowledge Base

1. **Download Ecobee manual PDF**
2. **Place in `pi-zero-bridge/docs/` directory**
   ```bash
   cp ~/Downloads/ecobee-manual.pdf pi-zero-bridge/docs/
   ```

3. **Run ingestion:**
   ```bash
   cd pi-zero-bridge
   python rag_groq.py ingest
   ```

4. **Query it:**
   ```bash
   python rag_groq.py query "How do I reset my Ecobee thermostat?"
   ```

## Option 2: Convert PDF to Text First (Simpler)

If you don't want to modify the RAG script:

### Step 1: Convert PDF to Text

**Using Python:**
```python
import PyPDF2

def pdf_to_text(pdf_path, output_path):
    with open(pdf_path, 'rb') as file:
        reader = PyPDF2.PdfReader(file)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
    
    with open(output_path, 'w', encoding='utf-8') as out:
        out.write(text)

pdf_to_text('ecobee-manual.pdf', 'ecobee-manual.txt')
```

**Using command line (pdftotext):**
```bash
# Install poppler-utils
sudo apt install poppler-utils

# Convert PDF to text
pdftotext ecobee-manual.pdf ecobee-manual.txt
```

### Step 2: Add Text File to Knowledge Base

```bash
cp ecobee-manual.txt pi-zero-bridge/docs/
python rag_groq.py ingest
```

## Option 3: Frontend PDF Query (Browser-Based)

If you want to query PDFs directly from the web app:

### Step 1: Add PDF.js Library

```bash
npm install pdfjs-dist
```

### Step 2: Create PDF Query Component

```javascript
// src/utils/pdfQuery.js
import * as pdfjsLib from 'pdfjs-dist';

export async function extractTextFromPDF(pdfUrl) {
  const loadingTask = pdfjsLib.getDocument(pdfUrl);
  const pdf = await loadingTask.promise;
  
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }
  
  return fullText;
}

export async function queryPDF(pdfUrl, question) {
  // Extract text
  const text = await extractTextFromPDF(pdfUrl);
  
  // Split into chunks
  const chunks = text.split(/\n\n+/);
  
  // Simple keyword matching (or use embeddings)
  const relevantChunks = chunks.filter(chunk => 
    question.toLowerCase().split(' ').some(word => 
      chunk.toLowerCase().includes(word)
    )
  );
  
  return relevantChunks.slice(0, 3).join('\n\n');
}
```

### Step 3: Use in Ask Joule

```javascript
// In useAskJoule.js
if (query.includes('ecobee manual') || query.includes('pdf')) {
  const pdfText = await queryPDF('/docs/ecobee-manual.pdf', query);
  // Use pdfText as context for LLM
}
```

## Recommended Approach

**For your use case (Ecobee manual):**

1. **Convert PDF to text** (Option 2 - simplest)
2. **Add to `public/knowledge/` directory**
3. **Update `hvacKnowledgeBase.js` to include it**
4. **Query via Ask Joule** (already works!)

## Quick Setup

```bash
# 1. Convert PDF to text
pdftotext ecobee-manual.pdf ecobee-manual.txt

# 2. Copy to knowledge base
cp ecobee-manual.txt public/knowledge/

# 3. Update knowledge base index (if needed)
# The existing RAG system should pick it up automatically
```

## Testing

After adding PDF content:

1. **Ask a question:**
   - "How do I reset my Ecobee?"
   - "What are the wiring terminals on Ecobee?"
   - "How do I pair my Ecobee with HomeKit?"

2. **Check if it answers from the manual**

## Troubleshooting

**PDF text extraction is messy:**
- Use `pdfplumber` instead of `PyPDF2` (better formatting)
- Or manually clean up the text file

**PDF is too large:**
- Split into chapters/sections
- Or increase chunk size in RAG config

**Can't find answers:**
- Check if text was extracted correctly
- Verify PDF is in the right directory
- Re-run ingestion after adding PDF

## Next Steps

1. Get Ecobee manual PDF
2. Convert to text (or use PDF loader)
3. Add to knowledge base
4. Query via Ask Joule!

