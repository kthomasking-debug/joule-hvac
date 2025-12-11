/**
 * Test to identify misclassified commands
 */

global.window = undefined;

import { parseAskJoule } from './src/utils/askJouleParser.js';

// Commands that should be recognized but are being classified as questions
const testCommands = [
  "Set temp = 68f in the living room.",
  "Turn the heat on.",
  "Turn the heat off.",
  "Put the system in AUTO.",
  "Set system mode to HEAT.",
  "Set system mode to OFF.",
  "Drop my nighttime setpoint to 65.",
  "Set day temp to 70 and night temp to 66.",
  "Turn away mode off.",
  "Disable vacation mode.",
  "Optimize my schedule for comfort first.",
  "Optimize my schedule for savings first.",
  "Make it run more efficiently in cold weather.",
  "Make sure strips stay off above 30°F.",
  "Don't use aux heat unless it's below 25°F.",
  "Run fan for 15 minutes every hour.",
  "Stop the fan after this cycle.",
  "Don't preheat before 5am.",
  "Pre-warm the house to 70 by 7am.",
  "Pre-cool to 72 by 6pm.",
  "Use weather forecast to plan my schedule.",
  "Adjust tonight's schedule based on the cold front.",
  "Keep the bedroom 2°F cooler than the rest of the house.",
  "Prioritize comfort in the nursery.",
  "Set upstairs to 70 and downstairs to 68.",
  "Only heat occupied rooms if possible.",
  "Use \"guest mode\" tonight.",
  "Reset all thermostat settings to default.",
  "Use more aggressive setbacks.",
  "Use milder setbacks at night.",
  "Keep the living room at 69°F from 5pm–10pm.",
  "Turn everything off when I say \"goodnight\".",
  "When I say \"I'm cold\", raise temp by 2 degrees.",
  "When I say \"I'm hot\", lower temp by 2 degrees.",
  "Use my learned preferences instead of defaults.",
  "Stop learning my behavior for now.",
  "Start learning again.",
  "Help me tune settings for a heat pump, not a furnace.",
  "Hide nerd stats, just keep things comfortable.",
  "Make my system \"run better\" today.",
];

console.log("🔍 Testing misclassified commands...\n");

let recognized = 0;
let questions = 0;
let unrecognized = 0;

for (const cmd of testCommands) {
  const result = await parseAskJoule(cmd);
  
  if (!result) {
    unrecognized++;
    console.log(`❌ "${cmd}" → null`);
  } else if (result.isCommand === false) {
    questions++;
    console.log(`❓ "${cmd}" → Question (should be command)`);
  } else if (result.action || result.squareFeet || result.cityName) {
    recognized++;
    console.log(`✅ "${cmd}" → ${result.action || 'data'}`);
  } else {
    unrecognized++;
    console.log(`❌ "${cmd}" → No action`);
  }
}

console.log(`\n📊 Results:`);
console.log(`   ✅ Recognized: ${recognized}`);
console.log(`   ❓ Misclassified as questions: ${questions}`);
console.log(`   ❌ Unrecognized: ${unrecognized}`);

