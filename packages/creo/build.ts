import { $, Glob } from "bun";
import { resolve, relative, dirname } from "path";
import { mkdir } from "node:fs/promises";

const root = import.meta.dir;
const outDir = resolve(root, "dist");
const repoRoot = resolve(root, "../..");

await $`rm -rf ${outDir}`;

// Mirror repo docs into the package so the npm tarball never drifts
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

// Resolve @/ aliases in emitted .d.ts
await $`bunx tsc -p tsconfig.build.json`;
await $`bunx tsc-alias -p tsconfig.build.json`;

console.log("\n✓ Build complete → dist/");
const stat = Bun.file(resolve(outDir, "index.js"));
console.log(`  index.js  ${(stat.size / 1024).toFixed(1)} KB`);
