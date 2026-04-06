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
  target: "browser",
  format: "esm",
  minify: false,
  sourcemap: "external",
  external: [],
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

// 2. Emit .d.ts via tsc, then resolve @/ path aliases
await $`bunx tsc -p tsconfig.build.json`;
await $`bunx tsc-alias -p tsconfig.build.json`;

console.log("\n✓ Build complete → dist/");
const stat = Bun.file(resolve(outDir, "index.js"));
console.log(`  index.js  ${(stat.size / 1024).toFixed(1)} KB`);
