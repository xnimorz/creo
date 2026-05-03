import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  server: {
    port: 5183,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../../packages/creo/src"),
      "creo": path.resolve(__dirname, "../../packages/creo/src/index.ts"),
      "creo-editor": path.resolve(
        __dirname,
        "../../packages/creo-editor/src/index.ts",
      ),
    },
  },
});
