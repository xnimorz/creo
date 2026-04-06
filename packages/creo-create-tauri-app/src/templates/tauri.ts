export type Target = "ios" | "android" | "macos" | "windows" | "linux" | "web";

export function cargoToml(name: string): string {
  // Sanitize name for Rust crate (lowercase, hyphens to underscores)
  const crateName = name.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();

  return `[package]
name = "${crateName}"
version = "0.0.1"
edition = "2021"

[lib]
name = "${crateName.replace(/-/g, "_")}_lib"
crate-type = ["lib", "cdylib", "staticlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
`;
}

export function buildRs(): string {
  return `fn main() {
    tauri_build::build()
}
`;
}

export function mainRs(): string {
  return `// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ${crateFnName()}::run()
}

// Note: The crate function name is derived from the lib name in Cargo.toml.
// If you renamed the lib, update the function call above accordingly.
`;
}

// Helper - this is a placeholder; the actual scaffold will inject the correct name
function crateFnName(): string {
  return "{crate_name}";
}

export function libRs(): string {
  return `#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
`;
}

export function tauriConf(name: string, targets: Target[]): string {
  const hasMobile = targets.includes("ios") || targets.includes("android");

  const conf: Record<string, unknown> = {
    $schema: "https://raw.githubusercontent.com/nicoverbruggen/tauri-v2-schema/refs/heads/main/src/tauri-conf.json",
    productName: name,
    version: "0.0.1",
    identifier: `com.${name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}.app`,
    build: {
      frontendDist: "../dist",
      devUrl: "http://localhost:5173",
      beforeDevCommand: "bun run dev",
      beforeBuildCommand: "bun run build",
    },
    app: {
      windows: [
        {
          title: name,
          width: 800,
          height: 600,
          resizable: true,
        },
      ],
      security: {
        csp: null,
      },
    },
    bundle: {
      active: true,
      targets: "all",
      icon: [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico",
      ],
    },
  };

  if (hasMobile) {
    // Mobile needs a broader CSP and possibly different window config
    (conf.app as Record<string, unknown>).withGlobalTauri = true;
  }

  return JSON.stringify(conf, null, 2);
}

export function capabilities(): string {
  return JSON.stringify(
    {
      $schema: "https://raw.githubusercontent.com/nicoverbruggen/tauri-v2-schema/refs/heads/main/src/capability.json",
      identifier: "default",
      description: "Capability for the main window",
      windows: ["main"],
      permissions: [
        "core:default",
        "opener:default",
      ],
    },
    null,
    2,
  );
}

export function rustToolchain(): string {
  return `[toolchain]
channel = "stable"
`;
}
