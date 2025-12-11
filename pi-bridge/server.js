/**
 * Joule Local RAG Bridge Server
 * Runs on Raspberry Pi 5 and provides local LLM API compatible with Groq
 * Uses Ollama with Llama 3.2 3B for fast, private responses
 */

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3002;
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const MODEL = process.env.MODEL || 'llama3.2:3b';

// RAG document storage
const DOCS_DIR = path.join(__dirname, 'docs');
if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
}

/**
 * Simple RAG: Search documents for relevant context
 */
function searchDocuments(query, maxResults = 3) {
    const files = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.txt') || f.endsWith('.md'));
    const results = [];
    
    if (files.length === 0) {
        return '';
    }
    
    for (const file of files) {
        try {
            const content = fs.readFileSync(path.join(DOCS_DIR, file), 'utf-8');
            const lines = content.split('\n');
            
            // Simple keyword matching (can be improved with embeddings)
            const queryLower = query.toLowerCase();
            const matches = lines
                .map((line, idx) => ({ line, idx, score: 0 }))
                .filter(({ line }) => {
                    const lineLower = line.toLowerCase();
                    return queryLower.split(' ').some(word => 
                        word.length > 3 && lineLower.includes(word)
                    );
                })
                .map(({ line, idx }) => ({
                    text: line,
                    line: idx + 1,
                    file: file,
                    score: queryLower.split(' ').filter(word => 
                        word.length > 3 && line.toLowerCase().includes(word)
                    ).length
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, maxResults);
            
            results.push(...matches);
        } catch (err) {
            console.error(`Error reading ${file}:`, err.message);
        }
    }
    
    const finalResults = results
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);
    
    if (finalResults.length > 0) {
        console.log(`🔍 RAG: Found ${finalResults.length} match(es) from ${finalResults.map(r => r.file).join(', ')}`);
    } else {
        console.log(`🔍 RAG: No matches found in ${files.length} document(s)`);
    }
    
    return finalResults.map(r => r.text).join('\n');
}

/**
 * Call Ollama API
 */
async function callOllama(prompt, systemPrompt = null) {
    return new Promise((resolve, reject) => {
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });
        
        const body = JSON.stringify({
            model: MODEL,
            messages: messages,
            stream: false,
            options: {
                temperature: 0.7,
                top_p: 0.9,
            }
        });
        
        const req = http.request(`${OLLAMA_HOST}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve(response.message?.content || response.response || 'No response');
                } catch (err) {
                    reject(new Error(`Failed to parse response: ${err.message}`));
                }
            });
        });
        
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

/**
 * Handle Ask Joule query with RAG
 */
async function handleAskJoule(query, context = {}) {
    try {
        // Search documents for relevant context
        const ragContext = searchDocuments(query);
        
        // Build system prompt (matching Joule's style)
        const systemPrompt = `You are Joule, an HVAC analytics engine. Be concise. Do not use filler phrases like 'Sure thing,' 'Certainly,' 'Here is the answer,' 'Great question,' or 'Let me break that down.' Start directly with the data or the solution.

STYLE GUIDE:
- Length: Maximum 3 sentences per concept. Total response under 100 words unless asked for a deep dive.
- Format: Use bullet points for lists. No intro fluff. No outro fluff.
- Tone: Direct, technical, authoritative. Like a senior engineer speaking to a junior engineer.
- If you cite a number, just cite it. Don't narrate the citation.

${ragContext ? `\nRELEVANT CONTEXT FROM DOCUMENTATION:\n${ragContext}\n` : ''}

${context.userSettings ? `\nUSER SETTINGS:\n${JSON.stringify(context.userSettings, null, 2)}\n` : ''}
${context.userLocation ? `\nUSER LOCATION:\n${JSON.stringify(context.userLocation, null, 2)}\n` : ''}`;
        
        console.log(`🤖 Calling Ollama with model: ${MODEL}`);
        // Call Ollama
        const response = await callOllama(query, systemPrompt);
        console.log(`💬 Response length: ${response.length} characters`);
        
        return {
            success: true,
            message: response,
            source: 'local-ollama',
            model: MODEL,
            usedRAG: !!ragContext
        };
    } catch (error) {
        console.error('❌ Error handling Ask Joule query:', error);
        return {
            success: false,
            error: true,
            message: `Local AI error: ${error.message}`
        };
    }
}

/**
 * HTTP Server
 */
const server = http.createServer(async (req, res) => {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    
    // CORS headers - set on all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Log incoming requests (except health checks to reduce noise)
    if (req.url !== '/health') {
        console.log(`\n[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    }
    
    // Health check
    if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'ok', 
            model: MODEL,
            ollama: OLLAMA_HOST,
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
                console.log(`📝 Query: "${query.substring(0, 60)}${query.length > 60 ? '...' : ''}"`);
                
                const response = await handleAskJoule(query, context || {});
                
                const duration = Date.now() - startTime;
                console.log(`✅ Response generated in ${duration}ms (RAG: ${response.usedRAG ? 'yes' : 'no'})`);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));
            } catch (error) {
                const duration = Date.now() - startTime;
                console.error(`❌ Error after ${duration}ms:`, error.message);
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
                
                console.log(`📄 Ingested document: ${safeFilename} (${content.length} bytes)`);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, filename: safeFilename }));
            } catch (error) {
                console.error(`❌ Ingest error:`, error.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }
    
    // 404
    console.log(`⚠️  404: ${req.method} ${req.url}`);
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
    console.log(`🚀 Joule Local RAG Bridge running on port ${PORT}`);
    console.log(`📚 Model: ${MODEL}`);
    console.log(`🔗 Ollama: ${OLLAMA_HOST}`);
    console.log(`📁 Docs directory: ${DOCS_DIR}`);
    console.log(`\n✅ Ready to handle requests!`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   API: http://localhost:${PORT}/api/ask-joule`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    server.close(() => {
        process.exit(0);
    });
});





