export function serverTs(): string {
  return `import { Hono } from "hono";
import { serveStatic } from "hono/bun";

const app = new Hono();

// API routes
app.get("/api/health", (c) => c.json({ status: "ok" }));

// Serve static files from dist/ (after running \`vite build\`)
app.use("/*", serveStatic({ root: "./dist" }));

export default {
  port: 3000,
  fetch: app.fetch,
};

console.log("Server running at http://localhost:3000");
`;
}

export function viteConfigWithServer(): string {
  return `import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
`;
}
