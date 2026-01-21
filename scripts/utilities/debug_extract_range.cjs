const fs = require("fs");
const parser = require("@babel/parser");
const path = process.argv[2];
const startStr = process.argv[3];
const endStr = process.argv[4];
if (!path || !startStr) {
  console.error(
    "Usage: node debug_extract_range.cjs <file> <startStr> [endStr]"
  );
  process.exit(1);
}
const content = fs.readFileSync(path, "utf8");
const startIdx = content.indexOf(startStr);
if (startIdx === -1) {
  console.error("start string not found");
  process.exit(1);
}
let endIdx = endStr ? content.indexOf(endStr, startIdx) : -1;
if (endStr && endIdx === -1) endIdx = -1;
let snippet;
if (endIdx === -1) snippet = content.slice(startIdx);
else snippet = content.slice(startIdx, endIdx + endStr.length);
console.log(
  "Snippet length",
  snippet.length,
  "from",
  startIdx,
  "to",
  endIdx,
  "\n--- start snippet ---"
);
console.log(snippet.slice(0, 500));
console.log("--- end snippet ---");
try {
  const ast = parser.parse(snippet, {
    sourceType: "module",
    plugins: ["jsx", "classProperties", "optionalChaining"],
  });
  console.log("Parsed OK");
} catch (e) {
  console.error(
    "Parse error:",
    e.message,
    "at",
    e.loc && e.loc.line,
    e.loc && e.loc.column
  );
  if (e.loc && e.loc.line) {
    const errLine = e.loc.line;
    const linesArr = snippet.split("\n");
    const start = Math.max(0, errLine - 3);
    const end = Math.min(linesArr.length - 1, errLine + 3);
    console.log("--- context around error ---");
    for (let i = start; i <= end; i++) {
      console.log(i + 1 + ": " + linesArr[i]);
    }
    console.log("--- end context ---");
  }
  process.exit(1);
}
