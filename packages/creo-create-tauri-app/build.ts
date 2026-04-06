import { $ } from "bun";
import { resolve } from "path";

const root = import.meta.dir;
const outDir = resolve(root, "dist");

// Clean
await $`rm -rf ${outDir}`;

// 1. Bundle JS (ESM) via Bun
const result = await Bun.build({
  entrypoints: [resolve(root, "src/index.ts")],
  outdir: outDir,
  target: "node",
  format: "esm",
  minify: false,
  sourcemap: "external",
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

// Prepend shebang for CLI usage
const outFile = resolve(outDir, "index.js");
const content = await Bun.file(outFile).text();
await Bun.write(outFile, `#!/usr/bin/env node\n${content}`);
await $`chmod +x ${outFile}`;

// 2. Emit .d.ts via tsc
await $`npx tsc -p tsconfig.build.json`;

console.log("\n\u2713 Build complete \u2192 dist/");
const stat = Bun.file(outFile);
console.log(`  index.js  ${(stat.size / 1024).toFixed(1)} KB`);
