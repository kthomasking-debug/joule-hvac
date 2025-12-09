/**
 * Joule Groq-Powered RAG Bridge Server
 * Runs on Raspberry Pi Zero 2 W
 * Lightweight: Local embeddings + Groq API inference
 */

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3002;
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2'; // Lightweight, ~100MB

// RAG document storage
const DOCS_DIR = path.join(__dirname, 'docs');
const RAG_DB_DIR = path.join(__dirname, 'rag_db');

if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
}
if (!fs.existsSync(RAG_DB_DIR)) {
    fs.mkdirSync(RAG_DB_DIR, { recursive: true });
}

/**
 * Run Python RAG script
 */
function runPythonScript(script, args = []) {
    return new Promise((resolve, reject) => {
        const pythonPath = process.env.PYTHON_PATH || 'python3';
        const scriptPath = path.join(__dirname, script);
        
        const proc = spawn(pythonPath, [scriptPath, ...args], {
            cwd: __dirname,
            env: {
                ...process.env,
                GROQ_API_KEY: GROQ_API_KEY,
            }
        });
        
        let stdout = '';
        let stderr = '';
        
        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        proc.on('close', (code) => {
            if (code === 0) {
                resolve(stdout);
            } else {
                reject(new Error(`Python script failed: ${stderr || stdout}`));
            }
        });
        
        proc.on('error', reject);
    });
}

/**
 * Ingest documents into RAG database
 */
async function ingestDocuments() {
    try {
        await runPythonScript('rag_groq.py', ['ingest', DOCS_DIR]);
        return { success: true, message: 'Documents ingested successfully' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Query RAG system with Groq
 */
async function queryRAG(query, context = {}) {
    if (!GROQ_API_KEY) {
        return {
            success: false,
            error: true,
            message: 'Groq API key not configured. Set GROQ_API_KEY environment variable.'
        };
    }
    
    try {
        // Build context string
        const contextStr = JSON.stringify({
            userSettings: context.userSettings || {},
            userLocation: context.userLocation || null,
        });
        
        const result = await runPythonScript('rag_groq.py', ['query', query, contextStr]);
        
        return {
            success: true,
            message: result.trim(),
            source: 'groq-api',
            model: 'llama-3.2-3b-versatile'
        };
    } catch (error) {
        return {
            success: false,
            error: true,
            message: `RAG query failed: ${error.message}`
        };
    }
}

/**
 * HTTP Server
 */
const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Health check
    if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'ok',
            mode: 'groq-powered',
            hasApiKey: !!GROQ_API_KEY,
            embeddingModel: EMBEDDING_MODEL,
            timestamp: new Date().toISOString()
        }));
        return;
    }
    
    // Ask Joule endpoint
    if (req.url === '/api/ask-joule' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { query, context } = JSON.parse(body);
                const response = await queryRAG(query, context || {});
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: false, 
                    error: true, 
                    message: error.message 
                }));
            }
        });
        return;
    }
    
    // Ingest documents endpoint
    if (req.url === '/api/ingest' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { filename, content } = JSON.parse(body);
                const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
                fs.writeFileSync(path.join(DOCS_DIR, safeFilename), content);
                
                // Trigger re-ingestion
                const ingestResult = await ingestDocuments();
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: ingestResult.success, 
                    filename: safeFilename,
                    message: ingestResult.message || ingestResult.error
                }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }
    
    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
    console.log(`🚀 Joule Groq-Powered RAG Bridge running on port ${PORT}`);
    console.log(`🔗 Mode: Groq API (lightweight local embeddings)`);
    console.log(`📁 Docs directory: ${DOCS_DIR}`);
    console.log(`💾 RAG DB: ${RAG_DB_DIR}`);
    console.log(`\n✅ Ready to handle requests!`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   API: http://localhost:${PORT}/api/ask-joule`);
    if (!GROQ_API_KEY) {
        console.log(`\n⚠️  WARNING: GROQ_API_KEY not set. Set it in environment or systemd service.`);
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    server.close(() => {
        process.exit(0);
    });
});






