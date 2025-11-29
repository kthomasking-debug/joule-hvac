const fs = require("fs");
const path = process.argv[2];
const s = fs.readFileSync(path, "utf8");
const lines = s.split("\n");
// Find last 'return (' to get the main return block (approx)
let lastClose = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].trim() === ";") break;
  if (lines[i].trim() === ");") {
    lastClose = i;
    break;
  }
}
// We'll just parse the entire file for tag balance
let stack = [];
const tagRe = /</;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // very naive tag detection
  let j = 0;
  while ((j = line.indexOf("<", j)) !== -1) {
    // skip closing tags when we detect '</'
    if (line[j + 1] === "/") {
      const m = line.slice(j + 2).match(/^\s*([A-Za-z0-9_:-]+)/);
      if (m) {
        const tag = m[1];
        if (stack.length === 0 || stack[stack.length - 1] !== tag) {
          console.error(
            "Tag mismatch at line",
            i + 1,
            ": expected",
            stack[stack.length - 1],
            "but found closing",
            tag
          );
          process.exit(1);
        } else {
          stack.pop();
        }
      }
    } else {
      // opening or self-closing
      const m = line.slice(j + 1).match(/^\s*([A-Za-z0-9_:-]+)/);
      if (m) {
        const tag = m[1];
        // detect self-closing by '/>' at end of chunk
        const rest = line.slice(j);
        const selfClosing = /\/>\s*$/.test(rest) || /<\w+[^>]*\/>/.test(rest);
        if (!selfClosing) {
          stack.push(tag);
        }
      }
    }
    j += 1;
  }
}
if (stack.length > 0)
  console.error("Unclosed tags remain:", stack.slice(0, 10));
else console.log("Tag balance OK.");
