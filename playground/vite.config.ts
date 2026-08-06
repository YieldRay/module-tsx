import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    // Use esbuild to minify. The default (oxc) minifier corrupts module-tsx's
    // pre-bundled TypeScript (breaks `ts.transpile`'s markLinkedReferences with
    // "Cannot read properties of undefined (reading 'kind')").
    minify: "esbuild",
    rollupOptions: {
      input: {
        // Main app + the standalone preview page (loaded inside the iframe).
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        preview: fileURLToPath(new URL("./preview.html", import.meta.url)),
      },
    },
  },
});
