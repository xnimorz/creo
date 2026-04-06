export function packageJson(name: string, withServer: boolean): string {
  const deps: Record<string, string> = {
    creo: "latest",
  };

  const devDeps: Record<string, string> = {
    vite: "^6.0.0",
    typescript: "^5",
  };

  const scripts: Record<string, string> = {
    dev: "vite",
    build: "vite build",
    preview: "vite preview",
  };

  if (withServer) {
    deps["hono"] = "^4";
    devDeps["@hono/node-server"] = "^1";
    scripts["dev:server"] = "bun run --watch src/server.ts";
    scripts["dev"] = "vite";
    scripts["start"] = "bun run src/server.ts";
  }

  return JSON.stringify(
    {
      name,
      version: "0.0.1",
      private: true,
      type: "module",
      scripts,
      dependencies: deps,
      devDependencies: devDeps,
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

export function viteConfig(): string {
  return `import { defineConfig } from "vite";

export default defineConfig({});
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
      }
      #app {
        text-align: center;
      }
      h1 {
        font-size: 2rem;
        margin-bottom: 1rem;
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
  return `import { view, div, h1, button, text } from "creo";

export const App = view(({ use }) => {
  const count = use(0);
  const increment = () => count.update((n) => n + 1);

  return {
    render() {
      div({}, () => {
        h1({}, () => {
          text("Creo App");
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
`;
}
