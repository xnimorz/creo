import { defineConfig } from "vite";
import path from "path";
import { markdownPlugin } from "./src/markdown/plugin";

export default defineConfig({
  base: "./",
  plugins: [markdownPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../packages/creo/src"),
      creo: path.resolve(__dirname, "../packages/creo/src/index.ts"),
      "creo-router": path.resolve(__dirname, "../packages/creo-router/src/index.ts"),
      "creo-editor": path.resolve(__dirname, "../packages/creo-editor/src/index.ts"),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, ".."), path.resolve(__dirname, "../packages")],
    },
  },
});
