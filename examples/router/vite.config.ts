import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../../src"),
      "creo": path.resolve(__dirname, "../../src/index.ts"),
      "creo-router": path.resolve(__dirname, "../../packages/creo-router/src/index.ts"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        canvas: path.resolve(__dirname, "canvas.html"),
      },
    },
  },
});
