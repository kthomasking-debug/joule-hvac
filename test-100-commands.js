/**
 * Test 100 comprehensive thermostat commands
 */

// Mock environment for Node.js
global.window = undefined;

import { parseAskJoule } from './src/utils/askJouleParser.js';

const commands = [
  "Set the thermostat to 70°F.",
  "Set temp to 70.",
  "Set temp = 68f in the living room.",
  "Make it 72 degrees downstairs.",
  "Turn the heat on.",
  "Turn the heat off.",
  "Switch to cooling mode.",
  "Put the system in AUTO.",
  "Set system mode to HEAT.",
  "Set system mode to OFF.",
  "Raise the temperature by 2 degrees.",
  "Lower the temp 3° in the bedroom.",
  "Drop my nighttime setpoint to 65.",
  "Set day temp to 70 and night temp to 66.",
  "Set schedule: 70°F at 7am, 66°F at 11pm.",
  "Weekday schedule 68/64, weekend 70/66.",
  "Set away mode.",
  "Turn away mode off.",
  "I'm leaving for 3 days, set vacation mode.",
  "Disable vacation mode.",
  "Keep the house at 60°F until Monday.",
  "Don't let temps go below 55 while I'm gone.",
  "What's the temperature inside right now?",
  "What's the outdoor temperature?",
  "What's my balance point?",
  "Are my heat strips running right now?",
  "Did the strips run last night?",
  "Am I using auxiliary heat today?",
  "How many hours did the heat pump run yesterday?",
  "How much did heating cost yesterday?",
  "What's my estimated heating cost this month?",
  "How much will it cost if I keep it at 72 all winter?",
  "Show me a 7-day cost forecast.",
  "Compare constant 70°F vs 68/64 setback.",
  "Am I wasting money with my current schedule?",
  "How can I lower my bill automatically?",
  "Lower my bill without making guests cold.",
  "Optimize my schedule for comfort first.",
  "Optimize my schedule for savings first.",
  "Use \"balanced\" mode for comfort vs cost.",
  "Make it run more efficiently in cold weather.",
  "Make sure strips stay off above 30°F.",
  "Set aux heat lockout to 28°F.",
  "Set lockout temperature to 24 degrees.",
  "Don't use aux heat unless it's below 25°F.",
  "Why did the system short cycle this morning?",
  "Why is my system turning on so much?",
  "Why did my thermostat jump to 75?",
  "Is something wrong with my heat pump?",
  "Do I need to change my filter?",
  "Remind me to change my filter in 30 days.",
  "What's my current humidity?",
  "Keep humidity below 50%.",
  "Turn on dehumidifier mode.",
  "Turn off dehumidifier.",
  "Run fan for 15 minutes every hour.",
  "Turn on FAN ONLY for 30 minutes.",
  "Stop the fan after this cycle.",
  "Use \"quiet\" mode at night.",
  "Don't preheat before 5am.",
  "Pre-warm the house to 70 by 7am.",
  "Pre-cool to 72 by 6pm.",
  "Use weather forecast to plan my schedule.",
  "Adjust tonight's schedule based on the cold front.",
  "How many degree-days did I use yesterday?",
  "Show me kWh per heating degree-day this week.",
  "Compare this winter to last winter.",
  "Am I using more energy than last year?",
  "How do I save money during a cold snap?",
  "Keep the bedroom 2°F cooler than the rest of the house.",
  "Prioritize comfort in the nursery.",
  "Set upstairs to 70 and downstairs to 68.",
  "Only heat occupied rooms if possible.",
  "Use \"guest mode\" tonight.",
  "Turn off guest mode.",
  "Reset all thermostat settings to default.",
  "Undo the last optimization you applied.",
  "What changes did you make to my schedule today?",
  "Show me today's event log.",
  "Summarize what happened with my system today.",
  "Explain why my bill was high last month.",
  "Explain my heating performance in plain English.",
  "Are my settings reasonable for my house?",
  "Use more aggressive setbacks.",
  "Use milder setbacks at night.",
  "Never let the house go below 62°F at night.",
  "Keep the living room at 69°F from 5pm–10pm.",
  "Turn everything off when I say \"goodnight\".",
  "When I say \"I'm cold\", raise temp by 2 degrees.",
  "When I say \"I'm hot\", lower temp by 2 degrees.",
  "Use my learned preferences instead of defaults.",
  "Stop learning my behavior for now.",
  "Start learning again.",
  "Diagnose why the house feels cold at 70°F.",
  "Help me tune settings for a heat pump, not a furnace.",
  "I switched from gas to a heat pump, what should I change?",
  "Show me advanced nerd stats.",
  "Hide nerd stats, just keep things comfortable.",
  "Make my system \"run better\" today.",
  "Fix the most expensive problem first.",
];

console.log("🧪 Testing 100 comprehensive thermostat commands...\n");

let recognized = 0;
let unrecognized = 0;
let questions = 0;
let commands_parsed = 0;
const unrecognizedList = [];
const questionList = [];

for (let i = 0; i < commands.length; i++) {
  const cmd = commands[i];
  try {
    const result = await parseAskJoule(cmd);
    
    if (result) {
      if (result.isCommand === false) {
        questions++;
        questionList.push({ num: i + 1, cmd, result });
      } else if (result.action || result.squareFeet || result.cityName) {
        commands_parsed++;
        recognized++;
        console.log(`✅ ${i + 1}. "${cmd}"`);
        if (result.action) {
          console.log(`   → Action: ${result.action}${result.value ? `, Value: ${result.value}` : ''}${result.mode ? `, Mode: ${result.mode}` : ''}`);
        }
      } else {
        unrecognized++;
        unrecognizedList.push({ num: i + 1, cmd, result });
        console.log(`❌ ${i + 1}. "${cmd}"`);
        console.log(`   → No action recognized`);
      }
    } else {
      unrecognized++;
      unrecognizedList.push({ num: i + 1, cmd, result: null });
      console.log(`❌ ${i + 1}. "${cmd}"`);
      console.log(`   → Returned null`);
    }
  } catch (error) {
    unrecognized++;
    unrecognizedList.push({ num: i + 1, cmd, error: error.message });
    console.log(`💥 ${i + 1}. "${cmd}"`);
    console.log(`   → Error: ${error.message}`);
  }
}

console.log(`\n📊 Summary:`);
console.log(`   ✅ Commands recognized: ${commands_parsed}`);
console.log(`   ❓ Questions detected: ${questions}`);
console.log(`   ❌ Unrecognized: ${unrecognized}`);
console.log(`   📈 Recognition rate: ${((commands_parsed / commands.length) * 100).toFixed(1)}%`);

if (unrecognizedList.length > 0) {
  console.log(`\n❌ Unrecognized Commands (${unrecognizedList.length}):\n`);
  unrecognizedList.forEach(({ num, cmd, result, error }) => {
    console.log(`${num}. "${cmd}"`);
    if (error) {
      console.log(`   Error: ${error}`);
    } else if (result) {
      console.log(`   Result:`, JSON.stringify(result, null, 2));
    } else {
      console.log(`   Result: null`);
    }
    console.log();
  });
}

if (questionList.length > 0) {
  console.log(`\n❓ Questions Detected (${questionList.length}):\n`);
  questionList.forEach(({ num, cmd }) => {
    console.log(`${num}. "${cmd}"`);
  });
}

process.exit(unrecognized > 0 ? 1 : 0);

