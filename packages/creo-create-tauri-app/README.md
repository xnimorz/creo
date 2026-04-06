# creo-create-tauri-app

CLI scaffolding tool for [Creo](../../README.md) + [Tauri v2](https://v2.tauri.app) cross-platform apps. Creates a ready-to-run desktop and/or mobile application with Creo as the UI framework.

## Usage

```bash
bunx creo-create-tauri-app my-app
```

Or without a name (will be prompted):

```bash
bunx creo-create-tauri-app
```

## Interactive Setup

The CLI asks:

1. **Project name** — directory name and package name (skipped if passed as argument)
2. **Target platforms** — multi-select from: macOS, Windows, Linux, iOS, Android, Web

Desktop targets (macOS, Windows, Linux) are selected by default. Mobile targets (iOS, Android) require additional setup after scaffolding.

## What Gets Generated

```
my-app/
├── package.json            # Creo + Tauri deps, dev/build scripts
├── tsconfig.json
├── vite.config.ts           # Vite frontend bundler
├── index.html
├── .gitignore
├── src/
│   ├── main.ts              # Creo app mount
│   └── app.ts               # Starter component
└── src-tauri/
    ├── Cargo.toml            # Rust dependencies
    ├── build.rs
    ├── rust-toolchain.toml
    ├── tauri.conf.json       # Tauri configuration
    ├── capabilities/
    │   └── default.json      # Security permissions
    ├── icons/
    │   └── .gitkeep
    └── src/
        ├── main.rs           # Rust entry point
        └── lib.rs            # Tauri setup + commands
```

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite` | Frontend dev server only |
| `build` | `vite build` | Build frontend to `dist/` |
| `tauri:dev` | `tauri dev` | Full desktop app with hot reload |
| `tauri:build` | `tauri build` | Production desktop build |

## Target Platforms

### Desktop (macOS, Windows, Linux)

Works out of the box after scaffolding:

```bash
cd my-app
bun install
bun run tauri:dev
```

**Prerequisite**: [Rust](https://rustup.rs) must be installed.

### iOS

Requires one-time initialization after scaffolding:

```bash
bunx tauri ios init        # Generate Xcode project
bunx tauri ios dev         # Run on simulator
bunx tauri ios build       # Build for distribution
```

**Prerequisites**: macOS with Xcode installed.

### Android

Requires one-time initialization after scaffolding:

```bash
bunx tauri android init    # Generate Android project
bunx tauri android dev     # Run on emulator
bunx tauri android build   # Build APK/AAB
```

**Prerequisites**: Android Studio with NDK installed.

### Web

When "Web" is selected, the app still works as a standard Vite app in the browser via `bun run dev`. The Tauri APIs gracefully degrade — you can use `window.__TAURI__` checks or `@tauri-apps/api` to conditionally use native features.

## Tauri Commands

The generated `src-tauri/src/lib.rs` includes a sample `greet` command:

```rust
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}
```

Call it from the frontend:

```ts
import { invoke } from "@tauri-apps/api/core";

const greeting = await invoke<string>("greet", { name: "World" });
```

## Icons

The generated project includes an empty `src-tauri/icons/` directory. Generate icons from a source image:

```bash
bunx tauri icon path/to/icon.png
```

This creates all required icon sizes for every platform.

## Customization

- **Tauri config**: Edit `src-tauri/tauri.conf.json` for window settings, bundle config, security policies
- **Rust backend**: Add commands and plugins in `src-tauri/src/lib.rs`
- **Capabilities**: Edit `src-tauri/capabilities/default.json` to grant additional permissions
- **Frontend**: Standard Creo app in `src/` — use any Creo patterns and packages
