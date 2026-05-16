import { $, Glob } from "bun";
import { resolve, relative, dirname } from "path";
import { mkdir } from "node:fs/promises";

const root = import.meta.dir;
const outDir = resolve(root, "dist");
const repoRoot = resolve(root, "../..");

// Clean
await $`rm -rf ${outDir}`;

// Copy guidance docs into the package so they ship in the npm tarball.
// Source-of-truth lives at the repo root / under docs/; we mirror on every
// build so the published package and the repo never drift.
await copyFile(resolve(repoRoot, "CHANGELOG.md"), resolve(root, "CHANGELOG.md"));
await copyFile(resolve(repoRoot, "AGENTS.md"), resolve(root, "AGENTS.md"));

const docsSrcRoot = resolve(repoRoot, "docs/content");
const docsDestRoot = resolve(root, "docs");
await $`rm -rf ${docsDestRoot}`;
const docsGlob = new Glob("**/*.md");
for await (const rel of docsGlob.scan({ cwd: docsSrcRoot })) {
  await copyFile(resolve(docsSrcRoot, rel), resolve(docsDestRoot, rel));
}

async function copyFile(src: string, dest: string): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });
  await Bun.write(dest, Bun.file(src));
  console.log(`  copied ${relative(root, dest)}`);
}

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
