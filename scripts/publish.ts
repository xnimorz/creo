import { readdir } from "fs/promises";
import { resolve } from "path";
import { $ } from "bun";

const root = resolve(import.meta.dir, "..");
const packagesDir = resolve(root, "packages");

interface PackageInfo {
  name: string;
  dir: string;
  version: string;
  hasBuild: boolean;
  deps: string[];
}

function parseOtp(argv: string[]): string | null {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--otp" && i + 1 < argv.length) return argv[i + 1]!;
    if (a.startsWith("--otp=")) return a.slice("--otp=".length);
  }
  if (process.env.NPM_OTP) return process.env.NPM_OTP;
  return null;
}

function promptOtp(): string {
  // Bun supports the synchronous Web `prompt()` global.
  const value = prompt("npm OTP (one-time password): ");
  return (value ?? "").trim();
}

async function main() {
  const dryRun = !process.argv.includes("--no-dry-run");
  let otp = parseOtp(process.argv);

  const entries = await readdir(packagesDir, { withFileTypes: true });
  const packageDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  const packages: PackageInfo[] = [];
  const nameSet = new Set<string>();

  // Read all package.json files
  for (const dir of packageDirs) {
    const pkgPath = resolve(packagesDir, dir, "package.json");
    const file = Bun.file(pkgPath);
    if (!(await file.exists())) continue;

    const pkg = await file.json();
    if (pkg.private) continue;

    nameSet.add(pkg.name);
    packages.push({
      name: pkg.name,
      dir,
      version: pkg.version,
      hasBuild: !!(pkg.scripts as Record<string, string>)?.build,
      deps: [
        ...Object.keys((pkg.peerDependencies as Record<string, string>) ?? {}),
        ...Object.keys((pkg.dependencies as Record<string, string>) ?? {}),
      ],
    });
  }

  // Topological sort: packages with no sibling deps first
  const sorted: PackageInfo[] = [];
  const remaining = [...packages];

  while (remaining.length > 0) {
    const next = remaining.findIndex((p) =>
      p.deps.every((d) => !nameSet.has(d) || sorted.some((s) => s.name === d)),
    );

    if (next === -1) {
      console.error(
        "Circular dependency detected among:",
        remaining.map((p) => p.name),
      );
      process.exit(1);
    }

    sorted.push(remaining.splice(next, 1)[0]!);
  }

  console.log(
    dryRun
      ? "\n🔍 DRY RUN (pass --no-dry-run to publish for real)\n"
      : "\n📦 Publishing packages\n",
  );

  // npm registry now requires an OTP for every `npm publish` of a public
  // package on accounts with 2FA enabled. Prompt once and reuse for every
  // package — the same code is valid for the whole 30s window.
  if (!dryRun && !otp) {
    otp = promptOtp();
    if (!otp) {
      console.error("No OTP provided. Pass --otp=<code>, set NPM_OTP, or enter when prompted.");
      process.exit(1);
    }
  }

  // Build and publish in order
  for (const pkg of sorted) {
    const pkgDir = resolve(packagesDir, pkg.dir);

    // Build
    if (pkg.hasBuild) {
      console.log(`Building ${pkg.name}...`);
      try {
        await $`cd ${pkgDir} && bun run build`.quiet();
      } catch (e) {
        console.error(`  ✗ Build failed for ${pkg.name}`);
        process.exit(1);
      }
      console.log(`  ✓ Built ${pkg.name}`);
    }

    // Publish
    console.log(`Publishing ${pkg.name}@${pkg.version}...`);
    try {
      if (dryRun) {
        await $`cd ${pkgDir} && npm publish --dry-run`;
      } else {
        await $`cd ${pkgDir} && npm publish --access public --otp=${otp!}`;
      }
      console.log(
        `  ✓ ${dryRun ? "(dry-run) " : ""}Published ${pkg.name}@${pkg.version}`,
      );
    } catch (e) {
      console.error(`  ✗ Publish failed for ${pkg.name}`);
      if (!dryRun) process.exit(1);
    }
  }

  console.log(
    `\n✓ Done. ${sorted.length} package(s) ${dryRun ? "would be" : ""} published.\n`,
  );
}

main();
