import { readdir } from "fs/promises";
import { resolve } from "path";

const root = resolve(import.meta.dir, "..");
const packagesDir = resolve(root, "packages");

type BumpType = "patch" | "minor" | "major";

function bumpVersion(version: string, type: BumpType): string {
  const parts = version.split(".").map(Number);
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  const patch = parts[2] ?? 0;
  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
}

async function main() {
  const bumpType = process.argv[2] as BumpType;
  if (!["patch", "minor", "major"].includes(bumpType)) {
    console.error("Usage: bun run scripts/version.ts <patch|minor|major>");
    process.exit(1);
  }

  const entries = await readdir(packagesDir, { withFileTypes: true });
  const packageDirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  const packages: { name: string; dir: string; pkg: Record<string, unknown>; oldVersion: string; newVersion: string }[] = [];

  // Read all package.json files
  for (const dir of packageDirs) {
    const pkgPath = resolve(packagesDir, dir, "package.json");
    const file = Bun.file(pkgPath);
    if (!(await file.exists())) continue;

    const pkg = await file.json();
    if (pkg.private) continue;

    const oldVersion = pkg.version as string;
    const newVersion = bumpVersion(oldVersion, bumpType);
    packages.push({ name: pkg.name, dir, pkg, oldVersion, newVersion });
  }

  if (packages.length === 0) {
    console.log("No publishable packages found.");
    return;
  }

  // Build a map of package names to new versions
  const versionMap = new Map(packages.map((p) => [p.name, p.newVersion]));

  // Update versions and cross-references
  for (const p of packages) {
    p.pkg.version = p.newVersion;

    // Update peerDependencies referencing sibling packages
    const peers = p.pkg.peerDependencies as Record<string, string> | undefined;
    if (peers) {
      for (const dep of Object.keys(peers)) {
        if (versionMap.has(dep)) {
          peers[dep] = `>=${versionMap.get(dep)!}`;
        }
      }
    }

    const pkgPath = resolve(packagesDir, p.dir, "package.json");
    await Bun.write(pkgPath, JSON.stringify(p.pkg, null, 2) + "\n");
  }

  console.log(`\n✓ Bumped ${bumpType} version for ${packages.length} package(s):\n`);
  for (const p of packages) {
    console.log(`  ${p.name}: ${p.oldVersion} → ${p.newVersion}`);
  }
  console.log();
}

main();
