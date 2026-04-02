import { defineConfig, type UserConfig } from "tsdown";
import * as esbuild from "esbuild";

const esbuildTypescript = await esbuild.build({
  entryPoints: ["node_modules/typescript/lib/typescript.js"],
  bundle: true,
  format: "esm",
  platform: "browser",
  minify: true,
  write: false,
});

/**
 * Rolldown cannot bundle TypeScript directly due to its use of Node.js-specific features and dynamic imports.
 * To work around this, we pre-bundle TypeScript using esbuild, which can handle these features and produce a browser-compatible ESM bundle.
 * We then create a custom plugin for tsdown that serves this pre-bundled TypeScript whenever the "typescript" module is imported.
 */
const bundleTypescriptPlugin: UserConfig["plugins"] = {
  name: "bundle-typescript-with-esbuild",
  resolveId: {
    order: "pre",
    handler(id: string) {
      if (id === "typescript") return "virtual:typescript-esm";
    },
  },
  async load(id: string) {
    if (id === "virtual:typescript-esm") {
      return esbuildTypescript.outputFiles[0].text;
    }
  },
};

export default defineConfig([
  // index.js — ESM, unbundled (external deps)
  {
    dts: true,
    entry: { index: "./src/index.ts" },
    format: "esm",
    platform: "browser",
    target: ["esnext"],
    outputOptions: {
      entryFileNames: "[name].js",
    },
  },
  // index.mjs — ESM, bundled (typescript bundled via esbuild for browser compatibility)
  {
    dts: false,
    entry: { index: "./src/index.ts" },
    format: "esm",
    platform: "browser",
    target: ["esnext"],
    deps: { alwaysBundle: (id) => id !== "typescript", onlyBundle: false },
    minify: true,
    plugins: bundleTypescriptPlugin,
    outputOptions: {
      entryFileNames: "[name].mjs",
    },
  },
  // index.umd.js — UMD, bundled + minified
  {
    dts: false,
    entry: { index: "./src/index.ts" },
    format: "umd",
    platform: "browser",
    target: ["esnext"],
    deps: { alwaysBundle: (id) => id !== "typescript", onlyBundle: false },
    minify: true,
    plugins: bundleTypescriptPlugin,
    outputOptions: {
      name: "ModuleTSX",
      entryFileNames: "[name].umd.js",
    },
  },
]);
