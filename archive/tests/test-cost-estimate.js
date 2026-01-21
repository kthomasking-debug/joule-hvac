#!/usr/bin/env node

/**
 * Test script for bridge /api/cost-estimate endpoint
 * 
 * Usage:
 *   node test-cost-estimate.js [pi-ip-address] [optional-port]
 *   
 * Examples:
 *   node test-cost-estimate.js 192.168.1.50        # Uses default port 3002
 *   node test-cost-estimate.js 192.168.1.50 3003   # Uses custom port
 *   node test-cost-estimate.js localhost           # Local testing
 */

const http = require('http');

// Get PI IP from command line or use default
const piIp = process.argv[2] || '192.168.1.50';
const port = process.argv[3] || 3002;

console.log(`\n🔧 Testing Bridge Dynamic Cost Estimation`);
console.log(`📍 Target: http://${piIp}:${port}`);
console.log(`${'='.repeat(60)}\n`);

async function testEndpoint(description, payload) {
    return new Promise((resolve) => {
        console.log(`\n📋 ${description}`);
        console.log(`📤 Payload: ${JSON.stringify(payload)}`);
        
        const postData = JSON.stringify(payload);
        
        const options = {
            hostname: piIp,
            port: port,
            path: '/api/cost-estimate',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
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
                    
                    if (result.success) {
                        console.log(`✅ Success!`);
                        console.log(`   Weekly:  $${result.weeklyCost.toFixed(2)}`);
                        console.log(`   Monthly: $${result.monthlyCost.toFixed(2)}`);
                        
                        if (result.breakdown && result.breakdown.length > 0) {
                            const bd = result.breakdown[0];
                            console.log(`   Sample:  Load=${bd.load_btu} BTU, kWh=${bd.kwh}, Cost=$${bd.cost}`);
                        }
                    } else {
                        console.log(`❌ Request failed: ${result.error || 'Unknown error'}`);
                    }
                } catch (e) {
                    console.log(`❌ Failed to parse response: ${e.message}`);
                    console.log(`   Raw response: ${data}`);
                }
                resolve();
            });
        });
        
        req.on('error', (error) => {
            console.log(`❌ Connection error: ${error.message}`);
            if (error.code === 'ECONNREFUSED') {
                console.log(`   Bridge not running at ${piIp}:${port}`);
                console.log(`   To start bridge locally: cd pi-zero-bridge && node server.js`);
            }
            resolve();
        });
        
        req.on('timeout', () => {
            req.abort();
            console.log(`❌ Request timeout (5s)`);
            resolve();
        });
        
        req.write(postData);
        req.end();
    });
}

async function runTests() {
    // Test 1: Basic heating scenario
    await testEndpoint(
        'Test 1: Basic heating (45°F outdoor, 70°F target, 1 week)',
        {
            outdoor_temp: 45,
            target_temp: 70,
            duration_hours: 168
        }
    );
    
    // Test 2: What-if lower target
    await testEndpoint(
        'Test 2: What-if lower target (45°F outdoor, 68°F target, 1 week)',
        {
            outdoor_temp: 45,
            target_temp: 68,
            duration_hours: 168
        }
    );
    
    // Test 3: Cold weather
    await testEndpoint(
        'Test 3: Cold weather (20°F outdoor, 70°F target, 1 week)',
        {
            outdoor_temp: 20,
            target_temp: 70,
            duration_hours: 168
        }
    );
    
    // Test 4: Single day
    await testEndpoint(
        'Test 4: Single day (45°F outdoor, 70°F target, 24 hours)',
        {
            outdoor_temp: 45,
            target_temp: 70,
            duration_hours: 24
        }
    );
    
    // Test 5: Cooling scenario
    await testEndpoint(
        'Test 5: Cooling scenario (90°F outdoor, 72°F target, 1 week)',
        {
            outdoor_temp: 90,
            target_temp: 72,
            duration_hours: 168
        }
    );
    
    // Test 6: Hourly array (3 days of temps)
    const hourlyTemps = [];
    for (let i = 0; i < 72; i++) {
        // Simulate 3-day cycle: cold at night, warm during day
        const hour = i % 24;
        if (hour >= 6 && hour <= 18) {
            hourlyTemps.push(48);  // Daytime
        } else {
            hourlyTemps.push(32);  // Nighttime
        }
    }
    
    await testEndpoint(
        'Test 6: Hourly forecast (3 days, varying temps)',
        {
            outdoor_temps_array: hourlyTemps,
            target_temp: 70,
            duration_hours: 72
        }
    );
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📖 Full documentation: See BRIDGE_DYNAMIC_COST_ESTIMATION.md`);
    console.log(`\nTests completed!\n`);
}

runTests().catch(console.error);
