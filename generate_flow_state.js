const fs = require("fs");

const content = fs.readFileSync("src/lib/store/use-flow.ts", "utf8");

const _updatedContent = content.replace(
  /nodes: \[\s*\{[\s\S]*?edges: \[\s*\{[\s\S]*?selectedNodeId: null,/m,
  `// PLACEHOLDER`,
);

// Wait, doing this with regex is hard and error-prone. Let's just create a new use-flow.ts file entirely using a JS script.
