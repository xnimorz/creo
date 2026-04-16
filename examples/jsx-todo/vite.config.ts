import { defineConfig } from "vite";
import path from "path";

const creoSrc = path.resolve(__dirname, "../../packages/creo/src");

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "creo",
  },
  resolve: {
    alias: [
      // Order matters: most specific first so /jsx-runtime wins over /.
      { find: "creo/jsx-dev-runtime", replacement: path.join(creoSrc, "jsx-dev-runtime.ts") },
      { find: "creo/jsx-runtime", replacement: path.join(creoSrc, "jsx-runtime.ts") },
      { find: "creo", replacement: path.join(creoSrc, "index.ts") },
      { find: "@", replacement: creoSrc },
    ],
  },
});
