const fs = require("fs");
const cp = require("child_process");
const file = process.argv[2];
if (!file) {
  console.error("Usage: node esbuildChunkCheck.cjs <file>");
  process.exit(1);
}
const content = fs.readFileSync(file, "utf8");
const lines = content.split("\n");
for (let n = 100; n <= lines.length; n += 50) {
  const chunk = lines.slice(0, n).join("\n");
  fs.writeFileSync("tmp_chunk.jsx", chunk);
  try {
    cp.execFileSync(
      "npx",
      [
        "esbuild",
        "tmp_chunk.jsx",
        "--bundle",
        "--outfile=tmp_out.js",
        "--jsx-factory=React.createElement",
        "--jsx-fragment=React.Fragment",
        "--loader:.jsx=jsx",
      ],
      { stdio: "pipe" }
    );
    console.log("OK up to", n);
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : e.message;
    console.error("Parse failed at n=", n);
    console.error(stderr.split("\n").slice(0, 8).join("\n"));
    process.exit(0);
  }
}
console.log("All chunks parse");
