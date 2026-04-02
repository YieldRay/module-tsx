import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveFromImportMap } from "./importmap.ts";
import type { ImportMapData } from "./importmap.ts";

// parseImportMaps() requires a DOM — tested via the browser demo only

describe("resolveFromImportMap", () => {
  it("resolves from global imports", () => {
    const map: ImportMapData = { imports: { react: "https://esm.sh/react" } };
    assert.equal(resolveFromImportMap("react", map), "https://esm.sh/react");
  });

  it("returns undefined for unknown specifier", () => {
    const map: ImportMapData = { imports: { react: "https://esm.sh/react" } };
    assert.equal(resolveFromImportMap("vue", map), undefined);
  });

  it("resolves from matching scope over global imports", () => {
    const map: ImportMapData = {
      imports: { react: "https://esm.sh/react" },
      scopes: {
        "https://example.com/app/": { react: "https://esm.sh/react@18" },
      },
    };
    assert.equal(
      resolveFromImportMap("react", map, "https://example.com/app/main.js"),
      "https://esm.sh/react@18",
    );
  });

  it("falls back to global imports when no scope matches", () => {
    const map: ImportMapData = {
      imports: { react: "https://esm.sh/react" },
      scopes: {
        "https://example.com/other/": { react: "https://esm.sh/react@17" },
      },
    };
    assert.equal(
      resolveFromImportMap("react", map, "https://example.com/app/main.js"),
      "https://esm.sh/react",
    );
  });

  it("prefers more specific scope", () => {
    const map: ImportMapData = {
      scopes: {
        "https://example.com/": { react: "https://esm.sh/react@17" },
        "https://example.com/app/": { react: "https://esm.sh/react@18" },
      },
    };
    assert.equal(
      resolveFromImportMap("react", map, "https://example.com/app/main.js"),
      "https://esm.sh/react@18",
    );
  });

  it("returns undefined when imports and scopes are empty", () => {
    assert.equal(resolveFromImportMap("react", {}), undefined);
  });
});
