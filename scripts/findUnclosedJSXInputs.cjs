const fs = require("fs");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const path = process.argv[2];
const code = fs.readFileSync(path, "utf8");
const ast = parser.parse(code, {
  sourceType: "module",
  plugins: ["jsx", "classProperties", "optionalChaining"],
});
let found = 0;
traverse(ast, {
  JSXOpeningElement(path) {
    const nameNode = path.node.name;
    const tag = nameNode.name || (nameNode.object && nameNode.object.name);
    if (tag === "input" && !path.node.selfClosing) {
      console.log("Unclosed input at line", path.node.loc.start.line);
      found++;
    }
  },
});
if (!found) console.log("All JSX input elements are self-closing");
