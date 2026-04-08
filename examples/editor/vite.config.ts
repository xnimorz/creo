import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../../packages/creo/src"),
      "creo": path.resolve(__dirname, "../../packages/creo/src/index.ts"),
      "creo-editor": path.resolve(__dirname, "../../packages/creo-editor/src/index.ts"),
    },
  },
  server: {
    port: 5180,
  },
});
