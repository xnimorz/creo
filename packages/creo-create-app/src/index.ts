import * as path from "node:path";
import * as fs from "node:fs";
import { askText, askYesNo, closePrompt } from "./prompt";
import { scaffold } from "./scaffold";

async function main(): Promise<void> {
  console.log("\ncreo-create-app\n");

  // Project name from CLI arg or prompt
  let name = process.argv[2] || "";
  if (!name) {
    name = await askText("Project name", "my-creo-app");
  }

  const dir = path.resolve(process.cwd(), name);

  if (fs.existsSync(dir) && fs.readdirSync(dir).length > 0) {
    console.error(`\nError: Directory "${name}" already exists and is not empty.`);
    closePrompt();
    process.exit(1);
  }

  // Server setup
  const withServer = await askYesNo("Include a server (Hono)?", false);

  closePrompt();

  // Scaffold
  console.log("");
  scaffold({ name, dir, withServer });

  // Summary
  console.log(`\u2713 Created "${name}" in ${dir}\n`);

  if (withServer) {
    console.log("  Server: Hono (serves static files from dist/ by default)");
    console.log("  Override: edit src/server.ts to add routes or middleware\n");
  }

  console.log("  Get started:\n");
  console.log(`    cd ${name}`);
  console.log("    bun install");
  console.log("    bun run dev");

  if (withServer) {
    console.log("");
    console.log("  To run the server (after building):");
    console.log("    bun run build");
    console.log("    bun run start");
    console.log("");
    console.log("  For development with API proxy:");
    console.log("    bun run dev:server  (in one terminal)");
    console.log("    bun run dev         (in another terminal)");
  }

  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
