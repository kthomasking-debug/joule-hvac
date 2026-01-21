// Comparison test: Agent Architecture vs Prompt Bloat
// Shows token efficiency and response quality

import { askJouleFallback } from './src/lib/groqAgent.js';
import { answerWithRAG } from './src/lib/groqAgent.js';

const API_KEY = process.argv[2] || process.env.GROQ_API_KEY || '';

if (!API_KEY) {
  console.error('Usage: node test-agent-vs-prompt.js YOUR_GROQ_API_KEY');
  process.exit(1);
}

const testQuestions = [
  "What's the temperature?",
  "Why does my heat pump heat slowly?",
  "How can I save energy?",
  "What's the humidity?",
  "Tell me a joke about thermostats",
];

async function testApproach(name, answerFunc, questions) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${name}`);
  console.log('='.repeat(80));

  const results = [];
  let totalTokens = 0;
  let totalTime = 0;

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    console.log(`\n${i + 1}. "${question}"`);

    const startTime = Date.now();
    const result = await answerFunc(question, API_KEY);
    const duration = Date.now() - startTime;

    if (result.error) {
      console.log(`   ❌ Error: ${result.message}`);
      results.push({ question, error: true });
    } else {
      const tokens = result.tokensUsed || 0;
      totalTokens += tokens;
      totalTime += duration;

      console.log(`   ✅ ${duration}ms, ${tokens} tokens`);
      console.log(`   Response: ${result.message.substring(0, 100)}...`);
      if (result.usedRAG) console.log(`   📚 Used RAG knowledge`);

      results.push({ question, tokens, duration, response: result.message });
    }

    // Wait to avoid rate limits
    if (i < questions.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log(`\n${'─'.repeat(80)}`);
  console.log(`Summary: ${name}`);
  console.log(`  Total tokens: ${totalTokens}`);
  console.log(`  Avg tokens/question: ${(totalTokens / questions.length).toFixed(0)}`);
  console.log(`  Avg response time: ${(totalTime / questions.length).toFixed(0)}ms`);
  console.log(`  Success rate: ${results.filter(r => !r.error).length}/${results.length}`);

  return {
    name,
    totalTokens,
    avgTokens: totalTokens / questions.length,
    avgTime: totalTime / questions.length,
    successRate: results.filter(r => !r.error).length / results.length,
    results,
  };
}

async function compareApproaches() {
  console.log('\n🧪 AGENT ARCHITECTURE vs PROMPT BLOAT COMPARISON');
  console.log(`Testing ${testQuestions.length} questions with each approach\n`);

  // Test old approach (prompt bloat)
  const oldResults = await testApproach(
    '📝 OLD: Reduced Prompt (20 lines, still monolithic)',
    async (q, key) => await askJouleFallback(q, key),
    testQuestions
  );

  console.log('\n\nWaiting 10 seconds before next batch...\n');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Test new approach (agent + RAG)
  const newResults = await testApproach(
    '🤖 NEW: Agent Architecture (15 lines + RAG)',
    async (q, key) => await answerWithRAG(q, key),
    testQuestions
  );

  // Comparison
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📊 COMPARISON RESULTS');
  console.log('='.repeat(80));

  const tokenSavings = ((oldResults.avgTokens - newResults.avgTokens) / oldResults.avgTokens * 100).toFixed(1);
  const timeSavings = ((oldResults.avgTime - newResults.avgTime) / oldResults.avgTime * 100).toFixed(1);

  console.log(`\nTokens per request:`);
  console.log(`  OLD: ${oldResults.avgTokens.toFixed(0)} tokens`);
  console.log(`  NEW: ${newResults.avgTokens.toFixed(0)} tokens`);
  console.log(`  💰 Savings: ${tokenSavings}% (${(oldResults.avgTokens - newResults.avgTokens).toFixed(0)} tokens/request)`);

  console.log(`\nResponse time:`);
  console.log(`  OLD: ${oldResults.avgTime.toFixed(0)}ms`);
  console.log(`  NEW: ${newResults.avgTime.toFixed(0)}ms`);
  console.log(`  ⚡ ${timeSavings > 0 ? 'Faster' : 'Slower'} by ${Math.abs(timeSavings).toFixed(1)}%`);

  console.log(`\nTotal tokens (${testQuestions.length} questions):`);
  console.log(`  OLD: ${oldResults.totalTokens} tokens`);
  console.log(`  NEW: ${newResults.totalTokens} tokens`);
  console.log(`  💰 Total savings: ${oldResults.totalTokens - newResults.totalTokens} tokens`);

  console.log(`\n${'='.repeat(80)}`);
  
  if (tokenSavings > 20) {
    console.log(`✅ AGENT WINS: ${tokenSavings}% more efficient!`);
  } else if (tokenSavings > 0) {
    console.log(`⚠️  MODEST IMPROVEMENT: ${tokenSavings}% savings`);
  } else {
    console.log(`❌ OLD APPROACH USED FEWER TOKENS`);
  }

  console.log(`\n📝 Key Insight:`);
  console.log(`   Agent architecture fetches knowledge on-demand instead of`);
  console.log(`   embedding everything in the prompt. More scalable and efficient.`);
}

compareApproaches().catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});

