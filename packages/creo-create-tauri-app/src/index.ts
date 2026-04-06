import * as path from "node:path";
import * as fs from "node:fs";
import { askText, askMultiSelect, closePrompt } from "./prompt";
import { scaffold } from "./scaffold";
import type { Target } from "./templates/tauri";

async function main(): Promise<void> {
  console.log("\ncreo-create-tauri-app\n");

  // Project name from CLI arg or prompt
  let name = process.argv[2] || "";
  if (!name) {
    name = await askText("Project name", "my-creo-tauri-app");
  }

  const dir = path.resolve(process.cwd(), name);

  if (fs.existsSync(dir) && fs.readdirSync(dir).length > 0) {
    console.error(
      `\nError: Directory "${name}" already exists and is not empty.`,
    );
    closePrompt();
    process.exit(1);
  }

  // Target selection
  const targets = (await askMultiSelect("Select target platforms:", [
    { label: "macOS", value: "macos", default: true },
    { label: "Windows", value: "windows", default: true },
    { label: "Linux", value: "linux", default: true },
    { label: "iOS", value: "ios" },
    { label: "Android", value: "android" },
    { label: "Web (browser-only fallback)", value: "web" },
  ])) as Target[];

  closePrompt();

  if (targets.length === 0) {
    console.error("\nError: At least one target must be selected.");
    process.exit(1);
  }

  // Scaffold
  console.log("");
  scaffold({ name, dir, targets });

  const hasMobile = targets.includes("ios") || targets.includes("android");
  const hasDesktop =
    targets.includes("macos") ||
    targets.includes("windows") ||
    targets.includes("linux");

  // Summary
  console.log(`\u2713 Created "${name}" in ${dir}\n`);
  console.log(`  Targets: ${targets.join(", ")}\n`);

  console.log("  Prerequisites:");
  console.log("    - Rust: https://rustup.rs");
  if (hasMobile) {
    if (targets.includes("ios")) {
      console.log("    - Xcode (for iOS)");
    }
    if (targets.includes("android")) {
      console.log("    - Android Studio + NDK (for Android)");
    }
  }

  console.log("\n  Get started:\n");
  console.log(`    cd ${name}`);
  console.log("    bun install");

  if (hasDesktop) {
    console.log("    bun run tauri:dev        # Desktop dev with hot reload");
  }

  if (hasMobile) {
    console.log("");
    console.log("  Mobile setup (run once after install):");
    if (targets.includes("ios")) {
      console.log("    bunx tauri ios init       # Initialize iOS project");
      console.log("    bunx tauri ios dev        # Run on iOS simulator");
    }
    if (targets.includes("android")) {
      console.log("    bunx tauri android init   # Initialize Android project");
      console.log("    bunx tauri android dev    # Run on Android emulator");
    }
  }

  console.log("\n  Build for production:\n");
  console.log("    bun run tauri:build");

  if (hasMobile) {
    if (targets.includes("ios")) {
      console.log("    bunx tauri ios build");
    }
    if (targets.includes("android")) {
      console.log("    bunx tauri android build");
    }
  }

  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
