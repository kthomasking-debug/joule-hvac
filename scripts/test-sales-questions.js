/**
 * Test script to validate Ask Joule's ability to handle sales-related questions
 * Tests 100 sales questions to ensure the bot can answer them confidently
 */

import { searchSalesFAQ, hasSalesIntent, EBAY_STORE_URL } from '../src/utils/rag/salesFAQ.js';

// Generate 100 sales-related test questions
const generateTestQuestions = () => {
  const questions = [
    // Pre-Sale Objections - "Is this a Scam?" Questions
    "Is this a real company?",
    "Is this legitimate?",
    "Is this a scam?",
    "Are you trustworthy?",
    "Is this real?",
    "Is this a real business?",
    "Where do you ship from?",
    "Where are you located?",
    "What's your shipping location?",
    "Do you have a phone number?",
    "Can I call you?",
    "What's your contact number?",
    "Are these just 3D printed?",
    "Is this 3D printed?",
    "Is this homemade?",
    
    // Technical Fit Questions
    "Does it need a C-Wire?",
    "Do I need a C-wire?",
    "Does it require a C wire?",
    "C-wire required?",
    "Does it work with 5GHz WiFi?",
    "Does it support 5GHz?",
    "5GHz WiFi support?",
    "Can I use it with Home Assistant?",
    "Home Assistant compatible?",
    "Does it work with HA?",
    "Does it work with Apple HomeKit?",
    "HomeKit support?",
    "Siri compatible?",
    "Apple Home support?",
    
    // Money Questions
    "Is there a subscription?",
    "Monthly subscription?",
    "Is there a monthly fee?",
    "Any recurring costs?",
    "What is the return policy?",
    "Can I return it?",
    "Return window?",
    "Do you offer bulk discounts?",
    "Bulk pricing?",
    "Volume discounts?",
    
    // Competitor Questions
    "Why not just use the Ecobee app?",
    "Ecobee app vs Joule?",
    "Is this better than Flair?",
    "Joule vs Flair?",
    "Is this better than Mysa?",
    "Joule vs Mysa?",
    "Why not Flair?",
    "Why not Mysa?",
    
    // Compatibility Questions
    "Does this work with Nest?",
    "Nest compatible?",
    "Works with Google Nest?",
    "Does this work with Ecobee?",
    "Ecobee compatible?",
    "Does this work with Honeywell?",
    "Honeywell T6 support?",
    "Works with Venstar?",
    "Does it work without internet?",
    "Offline operation?",
    "No WiFi needed?",
    
    // Pricing Questions
    "How much does it cost?",
    "What's the price?",
    "How much?",
    "Is there a monthly fee?",
    "Annual fee?",
    "Subscription cost?",
    "What's included in the free tier?",
    "Free features?",
    "Why is it $129?",
    "Why so expensive?",
    "What's your refund policy?",
    "Can I get a refund?",
    "Money back guarantee?",
    
    // Hardware Questions
    "What's included in the box?",
    "What do I get?",
    "What's in the package?",
    "Is there a warranty?",
    "Warranty included?",
    "How difficult is installation?",
    "Easy to install?",
    "Installation required?",
    "What hardware does it use?",
    "Raspberry Pi?",
    
    // Shipping Questions
    "How long does shipping take?",
    "Shipping time?",
    "When will it arrive?",
    "Do you ship to Canada?",
    "International shipping?",
    "Ship to Australia?",
    "Shipping costs?",
    
    // Features Questions
    "What features does it offer?",
    "What can it do?",
    "Capabilities?",
    "How does monitoring work?",
    "Automatic data collection?",
    "What does local control mean?",
    "Offline operation?",
    
    // Variants and variations
    "Is this legit?",
    "Can I trust you?",
    "Where are you based?",
    "What's your address?",
    "Contact information?",
    "Phone support?",
    "Customer service?",
    "Do you have support?",
    "Is this printed?",
    "DIY build?",
    "Needs C wire?",
    "Requires C wire?",
    "C wire needed?",
    "5G WiFi?",
    "2.4GHz only?",
    "Home Assistant integration?",
    "HA support?",
    "Works with HomeKit?",
    "Apple integration?",
    "Monthly subscription fee?",
    "Recurring payment?",
    "Subscription required?",
    "Return policy?",
    "30 day return?",
    "Bulk orders?",
    "Multiple units discount?",
    "Better than Ecobee app?",
    "Vs Ecobee app?",
    "Flair alternative?",
    "Mysa alternative?",
    "Nest support?",
    "Google Nest?",
    "Works with Ecobee thermostat?",
    "Honeywell compatible?",
    "Venstar support?",
    "Works offline?",
    "No internet required?",
    "Price?",
    "Cost?",
    "One-time purchase?",
    "No subscription?",
    "Free tier?",
    "Why $129?",
    "Refund?",
    "Warranty?",
    "In the box?",
    "What's included?",
    "Installation?",
    "Easy setup?",
    "Shipping?",
    "Delivery time?",
    "International?",
    "Features?",
    "What does it do?",
  ];
  
  return questions;
};

// Test a single question
const testQuestion = (question) => {
  const isSalesIntent = hasSalesIntent(question);
  const faqMatch = searchSalesFAQ(question);
  
  return {
    question,
    hasSalesIntent: isSalesIntent,
    faqMatch: faqMatch ? {
      question: faqMatch.question,
      category: faqMatch.category,
      answerLength: faqMatch.answer.length,
      score: faqMatch.score,
    } : null,
    canAnswer: !!faqMatch,
  };
};

// Run all tests
const runTests = () => {
  console.log('🧪 Testing Ask Joule Sales Questions\n');
  console.log('=' .repeat(80));
  
  const questions = generateTestQuestions();
  const results = questions.map(testQuestion);
  
  // Statistics
  const withSalesIntent = results.filter(r => r.hasSalesIntent).length;
  const withFAQMatch = results.filter(r => r.canAnswer).length;
  const withoutAnswer = results.filter(r => !r.canAnswer).length;
  
  // Category breakdown
  const categoryCounts = {};
  results.forEach(r => {
    if (r.faqMatch) {
      categoryCounts[r.faqMatch.category] = (categoryCounts[r.faqMatch.category] || 0) + 1;
    }
  });
  
  // Print results
  console.log(`\n📊 Test Results Summary:`);
  console.log(`   Total Questions: ${questions.length}`);
  console.log(`   Questions with Sales Intent: ${withSalesIntent} (${((withSalesIntent/questions.length)*100).toFixed(1)}%)`);
  console.log(`   Questions with FAQ Match: ${withFAQMatch} (${((withFAQMatch/questions.length)*100).toFixed(1)}%)`);
  console.log(`   Questions without Answer: ${withoutAnswer} (${((withoutAnswer/questions.length)*100).toFixed(1)}%)`);
  
  console.log(`\n📂 Answers by Category:`);
  Object.entries(categoryCounts).forEach(([category, count]) => {
    console.log(`   ${category}: ${count}`);
  });
  
  // Show questions without answers
  if (withoutAnswer > 0) {
    console.log(`\n⚠️  Questions Without FAQ Matches (${withoutAnswer}):`);
    results
      .filter(r => !r.canAnswer)
      .slice(0, 10) // Show first 10
      .forEach((r, idx) => {
        console.log(`   ${idx + 1}. "${r.question}"`);
      });
    if (withoutAnswer > 10) {
      console.log(`   ... and ${withoutAnswer - 10} more`);
    }
  }
  
  // Show sample successful matches
  console.log(`\n✅ Sample Successful Matches (first 10):`);
  results
    .filter(r => r.canAnswer)
    .slice(0, 10)
    .forEach((r, idx) => {
      console.log(`   ${idx + 1}. "${r.question}"`);
      console.log(`      → Matched: "${r.faqMatch.question}" (${r.faqMatch.category})`);
    });
  
  // Overall assessment
  console.log(`\n${'='.repeat(80)}`);
  const successRate = (withFAQMatch / questions.length) * 100;
  if (successRate >= 90) {
    console.log(`\n✅ EXCELLENT: ${successRate.toFixed(1)}% success rate - Ask Joule is ready for sales!`);
  } else if (successRate >= 75) {
    console.log(`\n✅ GOOD: ${successRate.toFixed(1)}% success rate - Ask Joule can handle most sales questions.`);
  } else if (successRate >= 60) {
    console.log(`\n⚠️  FAIR: ${successRate.toFixed(1)}% success rate - Consider adding more FAQ entries.`);
  } else {
    console.log(`\n❌ NEEDS IMPROVEMENT: ${successRate.toFixed(1)}% success rate - Add more FAQ entries.`);
  }
  
  console.log(`\n💡 Tip: Questions without matches will use fallback: ${EBAY_STORE_URL}`);
  console.log(`\n`);
  
  return {
    total: questions.length,
    withSalesIntent,
    withFAQMatch,
    withoutAnswer,
    successRate,
    categoryCounts,
  };
};

// Run tests
try {
  runTests();
} catch (err) {
  console.error('❌ Test runner error:', err);
  process.exit(1);
}

export { generateTestQuestions, testQuestion, runTests };

