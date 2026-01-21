const fs = require("fs");
const parser = require("@babel/parser");
const file = process.argv[2];
if (!file) {
  console.error("Usage: node find_first_parse_error.cjs file");
  process.exit(1);
}
const lines = fs.readFileSync(file, "utf8").split("\n");
for (let i = 1; i <= lines.length; i++) {
  try {
    parser.parse(lines.slice(0, i).join("\n"), {
      sourceType: "module",
      plugins: ["jsx", "classProperties", "optionalChaining"],
    });
  } catch (e) {
    console.log("Failed at line", i, "message:", e.message);
    process.exit(0);
  }
}
console.log("All ok");
