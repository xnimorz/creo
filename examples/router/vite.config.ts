import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../../packages/creo/src"),
      "creo": path.resolve(__dirname, "../../packages/creo/src/index.ts"),
      "creo-router": path.resolve(__dirname, "../../packages/creo-router/src/index.ts"),
    },
  },
});
