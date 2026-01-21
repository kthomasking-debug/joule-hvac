const fs = require("fs");
const path = process.argv[2];
if (!path) {
  console.error("Usage: node findOddQuotes.cjs file");
  process.exit(1);
}
const s = fs.readFileSync(path, "utf8");
const lines = s.split("\n");
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  const dq = (l.match(/\"/g) || []).length;
  const sq = (l.match(/\'/g) || []).length;
  if (dq % 2 === 1 || sq % 2 === 1)
    console.log(i + 1, "dq", dq, "sq", sq, l.trim());
}
