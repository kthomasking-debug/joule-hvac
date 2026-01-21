#!/usr/bin/env node

/**
 * Test script for bridge endpoints
 * Tests: /api/status, /api/wifi/signal, /api/setpoint, /api/mode
 */

const http = require('http');

// Configuration
const BRIDGE_IP = process.argv[2] || '192.168.1.50';
const BRIDGE_PORT = process.argv[3] || 3002;

console.log(`\n🔧 Testing Bridge Endpoints`);
console.log(`📍 Target: http://${BRIDGE_IP}:${BRIDGE_PORT}`);
console.log(`${'='.repeat(60)}\n`);

async function testEndpoint(method, path, description, body = null) {
    return new Promise((resolve) => {
        console.log(`\n📋 ${description}`);
        console.log(`   ${method} ${path}`);
        
        const options = {
            hostname: BRIDGE_IP,
            port: BRIDGE_PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 5000
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log(`   ✅ ${res.statusCode}`);
                    console.log(`   Response:`, JSON.stringify(result, null, 2));
                } catch (e) {
                    console.log(`   ✅ ${res.statusCode}`);
                    console.log(`   Response:`, data);
                }
                resolve();
            });
        });
        
        req.on('error', (error) => {
            console.log(`   ❌ Connection error: ${error.message}`);
            if (error.code === 'ECONNREFUSED') {
                console.log(`   Bridge not running at ${BRIDGE_IP}:${BRIDGE_PORT}`);
                console.log(`   Start with: cd pi-zero-bridge && node server.js`);
            }
            resolve();
        });
        
        req.on('timeout', () => {
            req.abort();
            console.log(`   ❌ Request timeout`);
            resolve();
        });
        
        if (body) {
            req.write(JSON.stringify(body));
        }
        
        req.end();
    });
}

async function runTests() {
    // Test 1: Get status
    await testEndpoint('GET', '/api/status', 'Get HVAC Status');
    
    // Test 2: Get WiFi signal
    await testEndpoint('GET', '/api/wifi/signal', 'Get WiFi Signal Strength');
    
    // Test 3: Change setpoint
    await testEndpoint('POST', '/api/setpoint', 'Change Setpoint to 72°F', {
        targetTemp: 72
    });
    
    // Test 4: Verify setpoint changed
    await testEndpoint('GET', '/api/status', 'Verify Setpoint Changed');
    
    // Test 5: Change mode to heat
    await testEndpoint('POST', '/api/mode', 'Change Mode to Heat', {
        mode: 'heat'
    });
    
    // Test 6: Verify mode changed
    await testEndpoint('GET', '/api/status', 'Verify Mode Changed');
    
    // Test 7: Change mode to cool
    await testEndpoint('POST', '/api/mode', 'Change Mode to Cool', {
        mode: 'cool'
    });
    
    // Test 8: Try invalid mode (should fail)
    await testEndpoint('POST', '/api/mode', 'Try Invalid Mode (should fail)', {
        mode: 'invalid'
    });
    
    // Test 9: Try invalid setpoint (should fail)
    await testEndpoint('POST', '/api/setpoint', 'Try Invalid Setpoint (should fail)', {
        targetTemp: 200
    });
    
    // Test 10: Get settings
    await testEndpoint('GET', '/api/settings', 'Get Settings');
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Tests completed!\n`);
}

runTests().catch(console.error);
