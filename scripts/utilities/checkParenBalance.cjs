const fs = require("fs");
const path = process.argv[2];
if (!path) {
  console.error("Usage: node checkParenBalance.cjs file");
  process.exit(1);
}
const s = fs.readFileSync(path, "utf8");
const lines = s.split("\n");
let balance = 0;
let firstNegative = -1;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  for (let ch of l) {
    if (ch === "(") balance++;
    if (ch === ")") balance--;
    if (balance < 0 && firstNegative === -1) firstNegative = i + 1;
  }
}
console.log("Final paren balance", balance);
if (firstNegative > 0) console.log("Negative at", firstNegative);
