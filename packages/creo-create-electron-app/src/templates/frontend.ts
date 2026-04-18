export function packageJson(name: string): string {
  return JSON.stringify(
    {
      name,
      version: "0.0.1",
      private: true,
      type: "module",
      main: "dist-electron/main.js",
      scripts: {
        dev: "vite",
        build: "vite build && electron-builder",
        preview: "vite preview",
        start: "electron .",
      },
      dependencies: {
        creo: "latest",
      },
      devDependencies: {
        vite: "^6.0.0",
        typescript: "^5",
        electron: "^33.0.0",
        "electron-builder": "^25.0.0",
        "vite-plugin-electron": "^0.29.0",
        "vite-plugin-electron-renderer": "^0.14.6",
        "@types/node": "^22",
      },
      build: {
        appId: `com.example.${name.replace(/[^a-zA-Z0-9]/g, "")}`,
        productName: name,
        files: ["dist/**/*", "dist-electron/**/*"],
        directories: {
          output: "release",
        },
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
      include: ["src", "electron"],
    },
    null,
    2,
  );
}

export function viteConfig(): string {
  return `import { defineConfig } from "vite";
import electron from "vite-plugin-electron/simple";
import renderer from "vite-plugin-electron-renderer";

export default defineConfig({
  plugins: [
    electron({
      main: {
        entry: "electron/main.ts",
      },
      preload: {
        input: "electron/preload.ts",
      },
      renderer: {},
    }),
    renderer(),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
});
`;
}

export function indexHtml(title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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
  return `import { view, div, h1, p, button, text, _ } from "creo";

export const App = view(({ use }) => {
  const count = use(0);
  const increment = () => count.update((n) => n + 1);

  return {
    render() {
      div(_, () => {
        h1(_, "Creo + Electron");
        p(_, "Cross-platform desktop app");
        button({ onClick: increment }, \`Count: \${count.get()}\`);
      });
    },
  };
});
`;
}

export function gitignore(): string {
  return `node_modules
dist
dist-electron
release
.vite
`;
}
