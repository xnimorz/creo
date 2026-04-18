import * as path from "node:path";
import * as fs from "node:fs";
import { askText, askMultiSelect, closePrompt } from "./prompt";
import { scaffold } from "./scaffold";
import type { Target } from "./templates/electron";

async function main(): Promise<void> {
  console.log("\ncreo-create-electron-app\n");

  let name = process.argv[2] || "";
  if (!name) {
    name = await askText("Project name", "my-creo-electron-app");
  }

  const dir = path.resolve(process.cwd(), name);

  if (fs.existsSync(dir) && fs.readdirSync(dir).length > 0) {
    console.error(
      `\nError: Directory "${name}" already exists and is not empty.`,
    );
    closePrompt();
    process.exit(1);
  }

  const targets = (await askMultiSelect("Select target platforms:", [
    { label: "macOS", value: "macos", default: true },
    { label: "Windows", value: "windows", default: true },
    { label: "Linux", value: "linux", default: true },
  ])) as Target[];

  closePrompt();

  if (targets.length === 0) {
    console.error("\nError: At least one target must be selected.");
    process.exit(1);
  }

  console.log("");
  scaffold({ name, dir, targets });

  console.log(`\u2713 Created "${name}" in ${dir}\n`);
  console.log(`  Targets: ${targets.join(", ")}\n`);

  console.log("  Get started:\n");
  console.log(`    cd ${name}`);
  console.log("    bun install");
  console.log("    bun run dev              # Dev with hot reload");
  console.log("");
  console.log("  Build for production:\n");
  console.log("    bun run build");
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
