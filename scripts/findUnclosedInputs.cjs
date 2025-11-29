const fs = require("fs");
const lines = fs
  .readFileSync(process.argv[2] || "src/pages/Settings.jsx", "utf8")
  .split("\n");
for (let i = 0; i < lines.length; i++) {
  const idx = lines[i].indexOf("<input");
  if (idx !== -1) {
    // find closing '/>' within next 6 lines
    let found = false;
    for (let j = i; j < Math.min(i + 8, lines.length); j++) {
      if (lines[j].includes("/>")) {
        found = true;
        break;
      }
      if (lines[j].includes(">") && !lines[j].includes("/>")) {
        // found closing '>' but not '/>' - so needs manual inspect
        console.log("Suspicious input at", i + 1, "closed by > at line", j + 1);
        found = true;
        break;
      }
    }
    if (!found) console.log("No closing found for input starting at", i + 1);
  }
}
