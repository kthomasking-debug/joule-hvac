const fs = require("fs");
const path = process.argv[2];
if (!path) {
  console.error("Usage: node checkDivs.cjs <file>");
  process.exit(1);
}
const s = fs.readFileSync(path, "utf8");
const lines = s.split("\n");
let balance = 0;
let firstNegative = -1;
let maxBalance = 0;
let maxBalanceLine = -1;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  const opens = (l.match(/<div\b/g) || []).length;
  const closes = (l.match(/<\/div>/g) || []).length;
  balance += opens - closes;
  if (balance < 0 && firstNegative === -1) firstNegative = i + 1;
  if (balance > maxBalance) {
    maxBalance = balance;
    maxBalanceLine = i + 1;
  }
  if (opens || closes) {
    console.log(`${i + 1}: opens=${opens} closes=${closes} balance=${balance}`);
  }
}
console.log("Final balance", balance);
if (firstNegative > 0) console.log("Negative balance at line", firstNegative);
console.log("Max balance", maxBalance, "at line", maxBalanceLine);
