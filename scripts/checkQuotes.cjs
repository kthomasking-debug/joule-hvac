const fs = require("fs");
const path = process.argv[2];
const s = fs.readFileSync(path, "utf8");
const lines = s.split("\n");
let dq = 0,
  sq = 0,
  bt = 0;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  for (let ch of l) {
    if (ch === '"') dq++;
    if (ch === "'") sq++;
    if (ch === "`") bt++;
  }
}
console.log("double", dq, "single", sq, "backticks", bt);
