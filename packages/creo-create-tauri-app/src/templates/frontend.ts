export function packageJson(name: string): string {
  return JSON.stringify(
    {
      name,
      version: "0.0.1",
      private: true,
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview",
        "tauri:dev": "tauri dev",
        "tauri:build": "tauri build",
      },
      dependencies: {
        creo: "latest",
        "@tauri-apps/api": "^2",
      },
      devDependencies: {
        vite: "^6.0.0",
        typescript: "^5",
        "@tauri-apps/cli": "^2",
      },
    },
    null,
    2,
  );
}

export function tsconfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ESNext",
        module: "ESNext",
        moduleResolution: "bundler",
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        lib: ["ESNext", "DOM"],
      },
      include: ["src"],
    },
    null,
    2,
  );
}

export function viteConfig(mobile: boolean): string {
  if (mobile) {
    return `import { defineConfig } from "vite";

// TAURI_DEV_HOST is set by the Tauri CLI for mobile dev
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
`;
  }

  return `import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
`;
}

export function indexHtml(title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
    <title>${title}</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: system-ui, -apple-system, sans-serif;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f5f5f5;
        color: #333;
        /* Prevent text selection on mobile for app-like feel */
        -webkit-user-select: none;
        user-select: none;
      }
      #app {
        text-align: center;
        padding: 2rem;
      }
      h1 {
        font-size: 2rem;
        margin-bottom: 1rem;
      }
      p {
        margin-bottom: 1rem;
        color: #666;
      }
      button {
        padding: 0.5rem 1.5rem;
        font-size: 1rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: #fff;
        cursor: pointer;
      }
      button:hover {
        background: #e9e9e9;
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`;
}

export function mainTs(): string {
  return `import { createApp, HtmlRender } from "creo";
import { App } from "./app";

createApp(
  () => {
    App();
  },
  new HtmlRender(document.querySelector("#app") as HTMLElement),
).mount();
`;
}

export function appTs(): string {
  return `import { view, div, h1, p, button, text } from "creo";

export const App = view(({ use }) => {
  const count = use(0);
  const increment = () => count.update((n) => n + 1);

  return {
    render() {
      div({}, () => {
        h1({}, () => {
          text("Creo + Tauri");
        });
        p({}, () => {
          text("Cross-platform desktop & mobile app");
        });
        button({ onClick: increment }, () => {
          text(\`Count: \${count.get()}\`);
        });
      });
    },
  };
});
`;
}

export function gitignore(): string {
  return `node_modules
dist
.vite

# Tauri
src-tauri/target
src-tauri/gen
`;
}
