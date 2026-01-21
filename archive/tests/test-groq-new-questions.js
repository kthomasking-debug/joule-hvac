// Manual test script to verify Groq integration handles new/diverse questions correctly
// This tests that the AI fallback can answer questions that aren't pre-programmed commands
// Usage: node test-groq-new-questions.js YOUR_GROQ_API_KEY

import { askJouleFallback } from './src/lib/groqAgent.js';

const API_KEY = process.argv[2] || process.env.VITE_GROQ_API_KEY || '';

if (!API_KEY) {
  console.error('❌ No API key provided.');
  console.error('Usage: node test-groq-new-questions.js YOUR_GROQ_API_KEY');
  console.error('Or set VITE_GROQ_API_KEY environment variable');
  process.exit(1);
}

// Test questions that are NOT pre-programmed commands
// These require the AI to understand context and generate appropriate responses
const testQuestions = [
  // Temperature-related
  {
    question: "What's the temperature?",
    expectedKeywords: ['temperature', 'degrees', 'temp', 'indoor', 'current'],
    category: 'Temperature Query'
  },
  {
    question: "Why does it feel colder than the thermostat says?",
    expectedKeywords: ['humidity', 'draft', 'insulation', 'air', 'feel', 'perception'],
    category: 'Comfort Reasoning'
  },
  
  // Energy-related
  {
    question: "How can I save energy this winter?",
    expectedKeywords: ['lower', 'thermostat', 'insulation', 'seal', 'programmable', 'temperature', 'savings'],
    category: 'Energy Savings'
  },
  {
    question: "What if I lowered my thermostat by 3 degrees?",
    expectedKeywords: ['save', 'cost', 'energy', 'percent', 'bill', 'money'],
    category: 'Energy Impact'
  },
  
  // System questions
  {
    question: "Is my heat pump efficient enough?",
    expectedKeywords: ['hspf', 'efficiency', 'rating', 'age', 'system', 'performance'],
    category: 'System Efficiency'
  },
  {
    question: "Should I get a new HVAC system?",
    expectedKeywords: ['age', 'efficiency', 'cost', 'repair', 'years', 'consider'],
    category: 'System Advice'
  },
  
  // Missing data (should handle gracefully)
  {
    question: "What's the humidity in my bedroom?",
    expectedKeywords: ['humidity', 'sensor', 'don\'t have', 'not available', 'no data', 'cannot'],
    category: 'Missing Data Handling'
  },
  {
    question: "Which rooms are too cold?",
    expectedKeywords: ['room', 'sensor', 'don\'t have', 'not available', 'no data', 'individual'],
    category: 'Missing Data Handling'
  },
  
  // Fun/personality questions
  {
    question: "Tell me a joke about thermostats",
    expectedKeywords: ['joke', 'funny', 'thermostat', 'temperature', 'humor'],
    category: 'Personality'
  },
  {
    question: "What temperature would a penguin prefer?",
    expectedKeywords: ['penguin', 'cold', 'antarctic', 'ice', 'freezing', 'degrees'],
    category: 'Personality'
  },
  
  // Complex reasoning
  {
    question: "Explain why my AC runs constantly on hot days",
    expectedKeywords: ['hot', 'capacity', 'load', 'temperature', 'design', 'outdoor', 'limit'],
    category: 'System Reasoning'
  },
  {
    question: "How does outdoor temperature affect my heating costs?",
    expectedKeywords: ['outdoor', 'temperature', 'cost', 'efficiency', 'heat', 'loss', 'colder'],
    category: 'Weather Impact'
  }
];

async function testQuestion(testCase, index, total) {
  const { question, expectedKeywords, category } = testCase;
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Test ${index + 1}/${total}: ${category}`);
  console.log(`Question: "${question}"`);
  console.log('-'.repeat(80));
  
  try {
    const startTime = Date.now();
    const result = await askJouleFallback(question, API_KEY);
    const duration = Date.now() - startTime;
    
    if (result.error) {
      console.log(`❌ FAIL - Error: ${result.message}`);
      if (result.needsSetup) {
        console.log('   (API key setup issue)');
      }
      return { passed: false, error: true };
    }
    
    const response = result.message || JSON.stringify(result);
    console.log(`✅ Response received (${duration}ms):`);
    console.log(`   ${response.substring(0, 200)}${response.length > 200 ? '...' : ''}`);
    
    // Check if response contains expected keywords
    const lowerResponse = response.toLowerCase();
    const matchedKeywords = expectedKeywords.filter(keyword => 
      lowerResponse.includes(keyword.toLowerCase())
    );
    
    const matchRate = matchedKeywords.length / expectedKeywords.length;
    
    if (matchRate >= 0.3) { // At least 30% of keywords should match
      console.log(`✅ PASS - Relevant response (matched ${matchedKeywords.length}/${expectedKeywords.length} keywords)`);
      console.log(`   Matched: ${matchedKeywords.join(', ')}`);
      return { passed: true, matchRate };
    } else {
      console.log(`⚠️  PARTIAL - Response may not be fully relevant (matched ${matchedKeywords.length}/${expectedKeywords.length} keywords)`);
      console.log(`   Expected keywords: ${expectedKeywords.join(', ')}`);
      console.log(`   Matched: ${matchedKeywords.join(', ') || 'none'}`);
      return { passed: false, partial: true, matchRate };
    }
    
  } catch (error) {
    console.log(`❌ FAIL - Exception: ${error.message}`);
    return { passed: false, error: true };
  }
}

async function runAllTests() {
  console.log('\n🤖 GROQ AI FALLBACK - NEW QUESTIONS TEST');
  console.log(`Testing with API key: ${API_KEY.substring(0, 10)}...`);
  console.log(`Total test questions: ${testQuestions.length}`);
  console.log(`${'='.repeat(80)}\n`);
  
  const results = [];
  
  for (let i = 0; i < testQuestions.length; i++) {
    const result = await testQuestion(testQuestions[i], i, testQuestions.length);
    results.push(result);
    
    // Longer delay between requests to avoid rate limiting on free tier (6000 TPM)
    if (i < testQuestions.length - 1) {
      console.log('\nWaiting 10 seconds to avoid rate limits...\n');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 TEST SUMMARY');
  console.log('-'.repeat(80));
  
  const passed = results.filter(r => r.passed).length;
  const partial = results.filter(r => r.partial).length;
  const failed = results.filter(r => !r.passed && !r.partial).length;
  
  console.log(`✅ Passed: ${passed}/${testQuestions.length}`);
  console.log(`⚠️  Partial: ${partial}/${testQuestions.length}`);
  console.log(`❌ Failed: ${failed}/${testQuestions.length}`);
  
  const avgMatchRate = results
    .filter(r => r.matchRate !== undefined)
    .reduce((sum, r) => sum + r.matchRate, 0) / results.length;
  
  console.log(`\n📈 Average keyword match rate: ${(avgMatchRate * 100).toFixed(1)}%`);
  
  if (passed >= testQuestions.length * 0.7) {
    console.log('\n✅ OVERALL: PASS - AI fallback handles diverse questions well!');
    process.exit(0);
  } else if (passed + partial >= testQuestions.length * 0.7) {
    console.log('\n⚠️  OVERALL: PARTIAL PASS - AI responds but may need prompt tuning');
    process.exit(0);
  } else {
    console.log('\n❌ OVERALL: FAIL - AI fallback needs improvement');
    process.exit(1);
  }
}

runAllTests().catch(error => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});

