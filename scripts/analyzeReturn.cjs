const fs = require("fs");
const path = process.argv[2];
if (!path) {
  console.error("Usage: node analyzeReturn.cjs file");
  process.exit(1);
}
const s = fs.readFileSync(path, "utf8");
const lines = s.split("\n");
// Find the last 'return (' occurrence (the component's main return should be at the end)
// Find the last ');' which closes the main return
let lastClose = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].trim() === ");") {
    lastClose = i + 1;
    break;
  }
}
if (lastClose === -1) {
  // fallback: last 'return ('
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes("return (")) {
      returnLine = i + 1;
      break;
    }
  }
} else {
  // find the nearest 'return (' above lastClose
  for (let i = lastClose - 1; i >= 0; i--) {
    if (lines[i].includes("return (")) {
      returnLine = i + 1;
      break;
    }
  }
}
// Find return for main SettingsPage component
let settingsStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (
    lines[i].includes("const SettingsPage") ||
    lines[i].includes("function SettingsPage")
  ) {
    settingsStart = i + 1;
    break;
  }
}
if (settingsStart !== -1) {
  for (let i = settingsStart; i < lines.length; i++) {
    if (lines[i].includes("return (")) {
      returnLine = i + 1;
      break;
    }
  }
} else {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("return (")) {
      returnLine = i + 1;
      break;
    }
  }
}
if (returnLine === -1) {
  console.log("No return found");
  process.exit(0);
}
console.log("Return at line", returnLine);
let startIndex = returnLine - 1;
// Find the first '<' in lines after returnLine
let firstTagLine = -1;
let firstTagIdx = -1;
for (let i = startIndex; i < lines.length; i++) {
  const idx = lines[i].indexOf("<");
  if (idx !== -1) {
    firstTagLine = i + 1;
    firstTagIdx = idx;
    break;
  }
}
console.log("First tag at", firstTagLine, "col", firstTagIdx);
// Now find the closing of the same top-level element by counting open tags (only '<div')
let open = 0;
for (let i = firstTagLine - 1; i < lines.length; i++) {
  const l = lines[i];
  // naive: count occurrences of '<' without '/' as opening; '</' as closing
  for (let j = 0; j < l.length; j++) {
    if (l[j] === "<" && l[j + 1] && l[j + 1] !== "/") {
      open++;
      j++;
    } else if (l[j] === "<" && l[j + 1] === "/") {
      open--;
      j++;
    }
  }
  if (open === 0) {
    console.log("Found end of root element at line", i + 1);
    break;
  }
}
// Print few lines after that
console.log("Context after end:");
const endLine = lines.findIndex(
  (line, idx) =>
    idx >= firstTagLine && line.includes(")") && idx >= firstTagLine
);
console.log(lines.slice(firstTagLine - 1, firstTagLine + 20).join("\n"));
console.log("done");
// Find the location of the ');' that closes the return expression
let returnCloseLine = -1;
for (let i = returnLine; i < lines.length; i++) {
  if (lines[i].trim() === ");") {
    returnCloseLine = i + 1;
    break;
  }
}
console.log("Return ends at line", returnCloseLine);
if (returnCloseLine > 0) {
  // Print lines around the closing to observe adjacent elements
  console.log("Lines near return close:");
  console.log(lines.slice(returnCloseLine - 6, returnCloseLine + 2).join("\n"));
}
