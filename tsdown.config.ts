import { defineConfig, type UserConfig } from "tsdown";
import * as esbuild from "esbuild";
import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
const dependencies = pkg.dependencies || {};

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

const esmShPlugin: UserConfig["plugins"] = {
  name: "rewrite-to-esm-sh",
  resolveId: {
    order: "pre",
    handler(id: string) {
      if (!id.startsWith(".") && !id.startsWith("/") && !id.startsWith("virtual:") && !id.startsWith("\0")) {
        const parts = id.split("/");
        const packageName = id.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
        const subpath = id.slice(packageName.length);

        if (dependencies[packageName]) {
          let version = dependencies[packageName];
          try {
            const pkgJson = JSON.parse(fs.readFileSync(`./node_modules/${packageName}/package.json`, "utf-8"));
            if (pkgJson.version) version = pkgJson.version;
          } catch {
            version = version.replace(/^[\^~]/, "");
          }
          return { id: `https://esm.sh/${packageName}@${version}${subpath}`, external: true };
        }
        return { id: `https://esm.sh/${id}`, external: true };
      }
    },
  },
};

export default defineConfig([
  // index.cdn.js — ESM, unbundled, external deps rewritten to esm.sh
  {
    dts: false,
    entry: { index: "./src/index.ts" },
    format: "esm",
    platform: "browser",
    target: ["esnext"],
    plugins: esmShPlugin,
    outputOptions: {
      entryFileNames: "[name].cdn.mjs",
    },
  },
  // index.dev.js — ESM with error overlay, unbundled, external deps rewritten to esm.sh
  {
    dts: false,
    entry: { index: "./src/index.dev.ts" },
    format: "esm",
    platform: "browser",
    target: ["esnext"],
    plugins: esmShPlugin,
    outputOptions: {
      entryFileNames: "[name].dev.mjs",
    },
  },
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
    dts: true,
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
