const fs = require("fs");
const path = process.argv[2];
if (!path) {
  console.error("Usage: node checkBraces.cjs <file>");
  process.exit(1);
}
const s = fs.readFileSync(path, "utf8");
let balance = 0;
let firstNegative = -1;
let maxBalance = 0;
let maxLine = -1;
const lines = s.split("\n");
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  for (let ch of l) {
    if (ch === "{") balance++;
    else if (ch === "}") balance--;
    if (balance < 0 && firstNegative === -1) {
      firstNegative = i + 1;
      break;
    }
  }
  if (balance > maxBalance) {
    maxBalance = balance;
    maxLine = i + 1;
  }
}
console.log("Final balance", balance);
if (firstNegative > 0) console.log("Negative at", firstNegative);
console.log("Max balance", maxBalance, "at line", maxLine);
