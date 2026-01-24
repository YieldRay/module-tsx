import { defineConfig } from "tsdown";

export default defineConfig({
  dts: true,
  entry: ["./src/index.ts"],
  format: {
    esm: {
      target: ["es2015"],
    },
    umd: {
      outputOptions: {
        name: "ModuleTSX",
      },
      target: ["es2015"],
      noExternal: () => true,
      minify: true,
      inlineOnly: false,
    },
  },
});
