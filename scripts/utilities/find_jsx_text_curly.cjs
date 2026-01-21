const fs = require("fs");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const path = process.argv[2];
if (!path) {
  console.error("Usage: node find_jsx_text_curly.cjs <file>");
  process.exit(1);
}
const content = fs.readFileSync(path, "utf8");
const ast = parser.parse(content, {
  sourceType: "module",
  plugins: ["jsx", "classProperties", "optionalChaining"],
});
let found = false;
traverse(ast, {
  JSXText(nodePath) {
    const val = nodePath.node.value;
    if (val.includes("}")) {
      const loc = nodePath.node.loc;
      console.log(
        "JSXText with } at line",
        loc && loc.start && loc.start.line,
        "value:",
        JSON.stringify(val.trim().slice(0, 80))
      );
      found = true;
    }
  },
});
if (!found) console.log("No JSX text containing } found");
