# creo-create-electron-app

CLI scaffolding tool for [Creo](../../README.md) + [Electron](https://www.electronjs.org) cross-platform desktop apps. Creates a ready-to-run Electron application with Creo as the UI framework.

## Usage

```bash
bunx creo-create-electron-app my-app
```

Or without a name (will be prompted):

```bash
bunx creo-create-electron-app
```

## Interactive Setup

The CLI asks:

1. **Project name** — directory name and package name (skipped if passed as argument)
2. **Target platforms** — multi-select from: macOS, Windows, Linux

## What Gets Generated

```
my-app/
├── package.json              # Creo + Electron deps, dev/build scripts
├── tsconfig.json
├── vite.config.ts            # Vite + vite-plugin-electron
├── index.html                # Renderer entry
├── electron-builder.json     # Packaging config per target
├── src/
│   ├── main.ts               # Creo renderer bootstrap
│   └── app.ts                # Example counter view
└── electron/
    ├── main.ts               # Main process — BrowserWindow
    └── preload.ts            # contextBridge preload
```

## Getting Started

```bash
cd my-app
bun install
bun run dev     # Dev with hot reload
bun run build   # Produce packaged binaries in release/
```
