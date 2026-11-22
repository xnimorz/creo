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
} from "./templates/base";
import { serverTs, viteConfigWithServer } from "./templates/server";

export interface ScaffoldOptions {
  name: string;
  dir: string;
  withServer: boolean;
}

function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

export function scaffold(options: ScaffoldOptions): void {
  const { name, dir, withServer } = options;

  writeFile(path.join(dir, "package.json"), packageJson(name, withServer));
  writeFile(path.join(dir, "tsconfig.json"), tsconfig());
  writeFile(path.join(dir, ".gitignore"), gitignore());
  writeFile(path.join(dir, "index.html"), indexHtml(name));

  if (withServer) {
    writeFile(path.join(dir, "vite.config.ts"), viteConfigWithServer());
  } else {
    writeFile(path.join(dir, "vite.config.ts"), viteConfig());
  }

  writeFile(path.join(dir, "src", "main.ts"), mainTs());
  writeFile(path.join(dir, "src", "app.ts"), appTs());

  if (withServer) {
    writeFile(path.join(dir, "src", "server.ts"), serverTs());
  }
}
