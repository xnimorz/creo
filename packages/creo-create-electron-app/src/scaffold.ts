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
  mainTs as electronMainTs,
  preloadTs,
  electronBuilderConfig,
  type Target,
} from "./templates/electron";

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

  // -- Frontend (renderer) --
  writeFile(path.join(dir, "package.json"), packageJson(name));
  writeFile(path.join(dir, "tsconfig.json"), tsconfig());
  writeFile(path.join(dir, ".gitignore"), gitignore());
  writeFile(path.join(dir, "index.html"), indexHtml(name));
  writeFile(path.join(dir, "vite.config.ts"), viteConfig());
  writeFile(path.join(dir, "src", "main.ts"), mainTs());
  writeFile(path.join(dir, "src", "app.ts"), appTs());

  // -- Electron (main + preload) --
  writeFile(path.join(dir, "electron", "main.ts"), electronMainTs());
  writeFile(path.join(dir, "electron", "preload.ts"), preloadTs());

  // -- electron-builder config --
  writeFile(
    path.join(dir, "electron-builder.json"),
    electronBuilderConfig(name, targets),
  );
}
