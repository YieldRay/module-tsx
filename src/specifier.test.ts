import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isBareSpecifier, isRelativeSpecifier, collectSpecifiers, createRewriteImportTransformer } from "./specifier.ts";
import { createSourceFile, printSourceFile, transform } from "./ts.ts";

describe("isBareSpecifier", () => {
  it("returns true for bare package names", () => {
    assert.ok(isBareSpecifier("react"));
    assert.ok(isBareSpecifier("react-dom"));
    assert.ok(isBareSpecifier("@scope/pkg"));
  });

  it("returns false for relative paths", () => {
    assert.ok(!isBareSpecifier("./foo"));
    assert.ok(!isBareSpecifier("../bar"));
    assert.ok(!isBareSpecifier("/abs/path"));
  });

  it("returns false for URLs", () => {
    assert.ok(!isBareSpecifier("https://esm.sh/react"));
    assert.ok(!isBareSpecifier("http://example.com/mod.js"));
    assert.ok(!isBareSpecifier("blob:null/abc"));
  });
});

describe("isRelativeSpecifier", () => {
  it("returns true for ./ and ../", () => {
    assert.ok(isRelativeSpecifier("./foo"));
    assert.ok(isRelativeSpecifier("../bar"));
    assert.ok(isRelativeSpecifier(".hidden"));
  });

  it("returns true for absolute paths starting with /", () => {
    assert.ok(isRelativeSpecifier("/abs"));
  });

  it("returns false for bare specifiers and URLs", () => {
    assert.ok(!isRelativeSpecifier("react"));
    assert.ok(!isRelativeSpecifier("https://esm.sh/react"));
  });
});

describe("collectSpecifiers", () => {
  it("collects static import specifiers", () => {
    const sf = createSourceFile(`import foo from "react";\nimport bar from "./bar.ts";`, "test.ts");
    const specs = collectSpecifiers(sf);
    assert.ok(specs.has("react"));
    assert.ok(specs.has("./bar.ts"));
  });

  it("collects re-export specifiers", () => {
    const sf = createSourceFile(`export { foo } from "some-lib";`, "test.ts");
    assert.ok(collectSpecifiers(sf).has("some-lib"));
  });

  it("collects dynamic import specifiers (string literals only)", () => {
    const sf = createSourceFile(`const m = import("dynamic-pkg");`, "test.ts");
    assert.ok(collectSpecifiers(sf).has("dynamic-pkg"));
  });

  it("ignores dynamic imports with non-literal arguments", () => {
    const sf = createSourceFile(`const m = import(someVar);`, "test.ts");
    assert.equal(collectSpecifiers(sf).size, 0);
  });

  it("returns empty set for code with no imports", () => {
    const sf = createSourceFile(`const x = 1;`, "test.ts");
    assert.equal(collectSpecifiers(sf).size, 0);
  });
});

describe("createRewriteImportTransformer", () => {
  const rewrite = (code: string, map: Record<string, string>): string => {
    const sf = createSourceFile(code, "test.ts");
    const transformed = transform(sf, [createRewriteImportTransformer(new Map(Object.entries(map)))]);
    return printSourceFile(transformed);
  };

  it("rewrites static import specifier", () => {
    const out = rewrite(`import React from "react";\nconsole.log(React);`, { react: "https://esm.sh/react" });
    assert.ok(out.includes("https://esm.sh/react"), out);
    assert.ok(!out.includes('"react"'), out);
  });

  it("rewrites re-export specifier", () => {
    const out = rewrite(`export { foo } from "lib";`, { lib: "https://esm.sh/lib" });
    assert.ok(out.includes("https://esm.sh/lib"), out);
  });

  it("rewrites dynamic import specifier", () => {
    const out = rewrite(`const m = import("pkg");`, { pkg: "https://esm.sh/pkg" });
    assert.ok(out.includes("https://esm.sh/pkg"), out);
  });

  it("leaves unmapped specifiers unchanged", () => {
    const out = rewrite(`import foo from "unchanged";\nconsole.log(foo);`, { other: "https://esm.sh/other" });
    assert.ok(out.includes('"unchanged"'), out);
  });
});
