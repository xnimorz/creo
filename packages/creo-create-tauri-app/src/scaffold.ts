import * as fs from "node:fs";
import * as path from "node:path";
import {
  packageJson,
  tsconfig,
  viteConfig,
  indexHtml,
  mainTs,
  appTs,
  gitignore,
} from "./templates/frontend";
import {
  cargoToml,
  buildRs,
  mainRs,
  libRs,
  tauriConf,
  capabilities,
  rustToolchain,
  type Target,
} from "./templates/tauri";

export interface ScaffoldOptions {
  name: string;
  dir: string;
  targets: Target[];
}

function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

export function scaffold(options: ScaffoldOptions): void {
  const { name, dir, targets } = options;
  const hasMobile = targets.includes("ios") || targets.includes("android");

  // -- Frontend (root) --
  writeFile(path.join(dir, "package.json"), packageJson(name));
  writeFile(path.join(dir, "tsconfig.json"), tsconfig());
  writeFile(path.join(dir, ".gitignore"), gitignore());
  writeFile(path.join(dir, "index.html"), indexHtml(name));
  writeFile(path.join(dir, "vite.config.ts"), viteConfig(hasMobile));
  writeFile(path.join(dir, "src", "main.ts"), mainTs());
  writeFile(path.join(dir, "src", "app.ts"), appTs());

  // -- Tauri (src-tauri/) --
  const tauriDir = path.join(dir, "src-tauri");
  writeFile(path.join(tauriDir, "Cargo.toml"), cargoToml(name));
  writeFile(path.join(tauriDir, "build.rs"), buildRs());
  writeFile(path.join(tauriDir, "rust-toolchain.toml"), rustToolchain());
  writeFile(path.join(tauriDir, "tauri.conf.json"), tauriConf(name, targets));
  writeFile(
    path.join(tauriDir, "capabilities", "default.json"),
    capabilities(),
  );

  // Rust sources — inject the correct crate name into main.rs
  const crateName = name.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
  const libName = crateName.replace(/-/g, "_") + "_lib";
  writeFile(path.join(tauriDir, "src", "lib.rs"), libRs());
  writeFile(
    path.join(tauriDir, "src", "main.rs"),
    mainRs().replace("{crate_name}", libName),
  );

  // Placeholder icons directory
  writeFile(
    path.join(tauriDir, "icons", ".gitkeep"),
    "# Run `tauri icon` to generate icons from a source image\n",
  );
}
