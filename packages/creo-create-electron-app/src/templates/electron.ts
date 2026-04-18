export type Target = "macos" | "windows" | "linux";

export function mainTs(): string {
  return `import { app, BrowserWindow } from "electron";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
`;
}

export function preloadTs(): string {
  return `import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("electron", {
  platform: process.platform,
  versions: process.versions,
});
`;
}

export function electronBuilderConfig(name: string, targets: Target[]): string {
  const mac = targets.includes("macos");
  const win = targets.includes("windows");
  const linux = targets.includes("linux");

  const config: Record<string, unknown> = {
    appId: `com.example.${name.replace(/[^a-zA-Z0-9]/g, "")}`,
    productName: name,
    files: ["dist/**/*", "dist-electron/**/*"],
    directories: {
      output: "release",
      buildResources: "build",
    },
  };

  if (mac) config.mac = { target: ["dmg", "zip"], category: "public.app-category.utilities" };
  if (win) config.win = { target: ["nsis"] };
  if (linux) config.linux = { target: ["AppImage", "deb"] };

  return JSON.stringify(config, null, 2);
}
