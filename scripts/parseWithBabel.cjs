const fs = require("fs");
const parser = require("@babel/parser");
const path = process.argv[2];
const content = fs.readFileSync(path, "utf8");
try {
  const ast = parser.parse(content, {
    sourceType: "module",
    plugins: ["jsx", "classProperties", "optionalChaining"],
  });
  // Find first top-level ReturnStatement in the AST
  let returnNode = null;
  function traverse(node) {
    if (!node || returnNode) return;
    if (Array.isArray(node)) {
      node.forEach(traverse);
      return;
    }
    if (node.type === "ReturnStatement") {
      returnNode = node;
      return;
    }
    for (const key of Object.keys(node)) {
      const val = node[key];
      if (typeof val === "object" && val !== null) traverse(val);
    }
  }
  traverse(ast.program.body);
  if (returnNode) {
    console.log(
      "Found ReturnStatement at loc:",
      returnNode.loc.start.line,
      returnNode.loc.start.column
    );
    const arg = returnNode.argument;
    console.log("Return argument type:", arg && arg.type);
    // If it's a JSXElement with multiple siblings, print child count
    if (arg && (arg.type === "JSXElement" || arg.type === "JSXFragment")) {
      const children = arg.children || [];
      console.log(
        "Top-level JSX has",
        children.length,
        "children (only non-empty)."
      );
      const nonEmpty = children.filter(
        (c) => !(c.type === "JSXText" && c.value.trim() === "")
      );
      console.log("Non-empty child count", nonEmpty.length);
    }
  }
  console.log(
    "AST parse OK (no syntax error, but further logic may detect layout issues)."
  );
} catch (e) {
  console.error(e.message);
  console.error("At line", e.loc && e.loc.line, "col", e.loc && e.loc.column);
}
