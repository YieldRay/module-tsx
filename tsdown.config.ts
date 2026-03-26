import { defineConfig } from "tsdown";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const tsVersion: string = require("typescript/package.json").version;

export default defineConfig([
  // index.js — ESM, unbundled (external deps)
  {
    dts: true,
    entry: { index: "./src/index.ts" },
    sourcemap: true,
    format: "esm",
    platform: "browser",
    target: ["esnext"],
    outputOptions: {
      entryFileNames: "[name].js",
    },
  },
  // index.mjs — ESM, bundled (typescript externalized to esm.sh for browser compatibility)
  {
    dts: false,
    entry: { index: "./src/index.ts" },
    sourcemap: true,
    format: "esm",
    platform: "browser",
    target: ["esnext"],
    noExternal: () => true,
    plugins: [
      {
        name: "resolve-typescript-to-esm-sh",
        resolveId(id) {
          if (id === "typescript") return { id: `https://esm.sh/typescript@${tsVersion}`, external: true };
        },
      },
    ],
    outputOptions: {
      entryFileNames: "[name].mjs",
    },
  },
  // index.umd.js — UMD, bundled + minified
  {
    dts: false,
    entry: { index: "./src/index.ts" },
    sourcemap: true,
    format: "umd",
    platform: "browser",
    target: ["esnext"],
    noExternal: () => true,
    inlineOnly: false,
    minify: true,
    outputOptions: {
      name: "ModuleTSX",
      entryFileNames: "[name].umd.js",
    },
  },
]);
