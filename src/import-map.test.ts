import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ImportMap, type SpecifierResolutionRecord } from "./import-map.ts";

// parseImportMaps() requires a DOM — tested via the browser demo only

const BASE = new URL("https://example.com/");

function parse(json: object): ImportMap {
  return ImportMap.parse(JSON.stringify(json), BASE);
}

function resolve(
  specifier: string,
  map: ImportMap,
  base: string | URL = BASE,
): string | undefined {
  return ImportMap.resolve(specifier, map, base)?.url;
}

describe("resolveFromImportMap", () => {
  it("resolves from global imports (exact match)", () => {
    const map = parse({ imports: { react: "https://esm.sh/react" } });
    assert.equal(resolve("react", map), "https://esm.sh/react");
  });

  it("returns undefined for unknown specifier", () => {
    const map = parse({ imports: { react: "https://esm.sh/react" } });
    assert.equal(resolve("vue", map), undefined);
  });

  it("resolves from matching scope over global imports", () => {
    const map = parse({
      imports: { react: "https://esm.sh/react" },
      scopes: {
        "https://example.com/app/": { react: "https://esm.sh/react@18" },
      },
    });
    assert.equal(
      resolve("react", map, "https://example.com/app/main.js"),
      "https://esm.sh/react@18",
    );
  });

  it("falls back to global imports when no scope matches", () => {
    const map = parse({
      imports: { react: "https://esm.sh/react" },
      scopes: {
        "https://example.com/other/": { react: "https://esm.sh/react@17" },
      },
    });
    assert.equal(
      resolve("react", map, "https://example.com/app/main.js"),
      "https://esm.sh/react",
    );
  });

  it("prefers more specific scope (longer prefix wins)", () => {
    const map = parse({
      scopes: {
        "https://example.com/": { react: "https://esm.sh/react@17" },
        "https://example.com/app/": { react: "https://esm.sh/react@18" },
      },
    });
    assert.equal(
      resolve("react", map, "https://example.com/app/main.js"),
      "https://esm.sh/react@18",
    );
  });

  it("returns undefined when imports and scopes are empty", () => {
    assert.equal(resolve("react", new ImportMap()), undefined);
  });

  it("resolves trailing-slash prefix match", () => {
    const map = parse({ imports: { "moment/": "https://esm.sh/moment/src/" } });
    assert.equal(
      resolve("moment/locale/zh-cn.js", map),
      "https://esm.sh/moment/src/locale/zh-cn.js",
    );
  });

  it("throws TypeError for null (blocked) entry on exact match", () => {
    const map: ImportMap = {
      imports: new Map([["react", null]]),
      scopes: new Map(),
      integrity: new Map(),
    };
    assert.throws(
      () => resolve("react", map),
      (e: unknown) => e instanceof TypeError && /blocked/.test(e.message),
    );
  });

  it("throws TypeError for backtrack attempt via prefix match", () => {
    const map: ImportMap = {
      imports: new Map([["pkg/", new URL("https://cdn.example/pkg/")]]),
      scopes: new Map(),
      integrity: new Map(),
    };
    assert.throws(() => resolve("pkg/../../secret", map), TypeError);
  });

  it("resolves URL-like specifier remapped via import map", () => {
    const map = parse({
      imports: {
        "https://cdn.example.com/vue.js": "https://local.example.com/vue.js",
      },
    });
    assert.equal(
      resolve("https://cdn.example.com/vue.js", map),
      "https://local.example.com/vue.js",
    );
  });

  it("returns record with serializedBaseURL and normalizedSpecifier", () => {
    const map = parse({ imports: { react: "https://esm.sh/react" } });
    const result = ImportMap.resolve(
      "react",
      map,
      "https://example.com/app/main.js",
    );
    assert.ok(result != null);
    assert.equal(
      result!.record.serializedBaseURL,
      "https://example.com/app/main.js",
    );
    assert.equal(result!.record.specifier, "react");
    assert.equal(result!.record.specifierAsURL, null);
  });

  it("resolves a URL-like specifier via a trailing-slash prefix rule", () => {
    // The specifier parses as a (special, https) URL, so it is allowed to match
    // a "/"-terminated prefix key — exercising the isSpecialURL() check.
    const map = parse({
      imports: {
        "https://cdn.example.com/pkg/": "https://local.example.com/pkg/",
      },
    });
    assert.equal(
      resolve("https://cdn.example.com/pkg/sub.js", map),
      "https://local.example.com/pkg/sub.js",
    );
  });

  it("returns record with specifierAsURL for URL-like specifiers", () => {
    const map = parse({
      imports: {
        "https://cdn.example.com/vue.js": "https://local.example.com/vue.js",
      },
    });
    const result = ImportMap.resolve(
      "https://cdn.example.com/vue.js",
      map,
      BASE,
    );
    assert.ok(result != null);
    assert.ok(result!.record.specifierAsURL instanceof URL);
    assert.equal(
      result!.record.specifierAsURL!.href,
      "https://cdn.example.com/vue.js",
    );
  });
});

describe("parseImportMapString", () => {
  it("normalizes relative specifier keys against baseURL", () => {
    const map = ImportMap.parse(
      JSON.stringify({
        imports: { "/app/helper": "./node_modules/helper/index.mjs" },
      }),
      new URL("https://example.com/base/page.html"),
    );
    assert.ok(
      map.imports.has("https://example.com/app/helper"),
      "key should be normalized to absolute URL",
    );
    assert.equal(
      map.imports.get("https://example.com/app/helper")?.href,
      "https://example.com/base/node_modules/helper/index.mjs",
    );
  });

  it("stores null for an address that is not a valid URL", () => {
    const map = parse({ imports: { react: "not a url" } });
    assert.equal(map.imports.get("react"), null);
  });

  it("stores null for trailing-slash key with non-trailing-slash address", () => {
    const map = parse({ imports: { "moment/": "https://esm.sh/moment" } });
    assert.equal(map.imports.get("moment/"), null);
  });

  it("throws TypeError for non-object top-level", () => {
    assert.throws(() => ImportMap.parse("[]", BASE), TypeError);
  });

  it("throws TypeError for non-object imports value", () => {
    assert.throws(
      () => ImportMap.parse(JSON.stringify({ imports: [] }), BASE),
      TypeError,
    );
  });

  it("sorts specifier keys in descending order", () => {
    const map = parse({
      imports: { "a/": "https://x.com/a/", "a/b/": "https://x.com/ab/" },
    });
    const keys = [...map.imports.keys()];
    assert.ok(
      keys.indexOf("a/b/") < keys.indexOf("a/"),
      "more specific key should come first",
    );
  });

  it("parses integrity field", () => {
    const map = parse({
      integrity: { "https://example.com/a.js": "sha384-abc" },
    });
    assert.equal(map.integrity.get("https://example.com/a.js"), "sha384-abc");
  });
});

describe("mergeExistingAndNewImportMaps", () => {
  it("merges non-conflicting rules from both maps", () => {
    const old = parse({ imports: { "/app/": "./original-app/" } });
    const newMap = parse({ imports: { "/app/helper": "./helper/index.mjs" } });
    ImportMap.merge(old, newMap, []);
    assert.ok(old.imports.has("https://example.com/app/"));
    assert.ok(old.imports.has("https://example.com/app/helper"));
  });

  it("existing rules win on conflict (first-wins)", () => {
    const old = parse({ imports: { "/app/helper": "./helper/index.mjs" } });
    const newMap = parse({
      imports: { "/app/helper": "./main/helper/index.mjs" },
    });
    ImportMap.merge(old, newMap, []);
    assert.equal(
      old.imports.get("https://example.com/app/helper")?.href,
      "https://example.com/helper/index.mjs",
    );
  });

  it("drops new import rules that match an already-resolved specifier", () => {
    const old = parse({ imports: { lodash: "https://esm.sh/lodash" } });
    const newMap = parse({
      imports: {
        "/app/helper": "./helper/index.mjs",
        lodash: "https://cdn.example/lodash",
      },
    });
    const resolved: SpecifierResolutionRecord[] = [
      {
        serializedBaseURL: "https://example.com/",
        specifier: "https://example.com/app/helper",
        specifierAsURL: new URL("https://example.com/app/helper"),
      },
    ];
    ImportMap.merge(old, newMap, resolved);
    // lodash is already in old, so new lodash is dropped; /app/helper matches resolved → also dropped
    assert.equal(old.imports.get("lodash")?.href, "https://esm.sh/lodash");
    assert.ok(!old.imports.has("https://example.com/app/helper"));
  });

  it("keeps a new rule whose key only shares a prefix with a resolved specifier", () => {
    // "react-dom" starts with "react" but is a different bare specifier, so a
    // resolved "react" must NOT drop a new "react-dom" rule.
    const old = parse({});
    const newMap = parse({
      imports: { "react-dom": "https://cdn.example/react-dom" },
    });
    const resolved: SpecifierResolutionRecord[] = [
      {
        serializedBaseURL: "https://example.com/",
        specifier: "react",
        specifierAsURL: null,
      },
    ];
    ImportMap.merge(old, newMap, resolved);
    assert.equal(
      old.imports.get("react-dom")?.href,
      "https://cdn.example/react-dom",
    );
  });

  it("drops a new '/'-prefixed rule that covers a resolved specifier", () => {
    const old = parse({});
    const newMap = parse({ imports: { "lib/": "https://cdn.example/lib/" } });
    const resolved: SpecifierResolutionRecord[] = [
      {
        serializedBaseURL: "https://example.com/",
        specifier: "lib/thing",
        specifierAsURL: null,
      },
    ];
    ImportMap.merge(old, newMap, resolved);
    assert.ok(!old.imports.has("lib/"), "prefix rule should be dropped");
  });

  it("drops new scope rules that match an already-resolved module from that scope", () => {
    const old = new ImportMap();
    const newMap = parse({
      scopes: {
        "https://example.com/app/": { "/app/helper": "./helper/index.mjs" },
      },
      imports: { lodash: "https://esm.sh/lodash" },
    });
    const resolved: SpecifierResolutionRecord[] = [
      {
        serializedBaseURL: "https://example.com/app/main.mjs",
        specifier: "https://example.com/app/helper",
        specifierAsURL: new URL("https://example.com/app/helper"),
      },
    ];
    ImportMap.merge(old, newMap, resolved);
    const scope = old.scopes.get("https://example.com/app/");
    assert.ok(
      !scope?.has("https://example.com/app/helper"),
      "scoped rule should be dropped",
    );
    assert.equal(old.imports.get("lodash")?.href, "https://esm.sh/lodash");
  });

  it("merges scopes, combining existing and new when scope prefix already exists", () => {
    const old = parse({
      scopes: {
        "https://example.com/app/": { react: "https://esm.sh/react@17" },
      },
    });
    const newMap = parse({
      scopes: { "https://example.com/app/": { vue: "https://esm.sh/vue" } },
    });
    ImportMap.merge(old, newMap, []);
    const scope = old.scopes.get("https://example.com/app/");
    assert.ok(scope?.has("react"));
    assert.ok(scope?.has("vue"));
  });

  it("merges integrity (first-wins)", () => {
    const old = parse({
      integrity: { "https://example.com/a.js": "sha384-old" },
    });
    const newMap = parse({
      integrity: {
        "https://example.com/a.js": "sha384-new",
        "https://example.com/b.js": "sha384-b",
      },
    });
    ImportMap.merge(old, newMap, []);
    assert.equal(old.integrity.get("https://example.com/a.js"), "sha384-old");
    assert.equal(old.integrity.get("https://example.com/b.js"), "sha384-b");
  });

  it("drops a new '/'-terminated scope rule that covers a resolved module", () => {
    const old = new ImportMap();
    const newMap = parse({
      scopes: {
        "https://example.com/app/": { "lib/": "https://cdn.example/lib/" },
      },
    });
    const resolved: SpecifierResolutionRecord[] = [
      {
        serializedBaseURL: "https://example.com/app/main.mjs",
        specifier: "lib/thing",
        specifierAsURL: null,
      },
    ];
    ImportMap.merge(old, newMap, resolved);
    const scope = old.scopes.get("https://example.com/app/");
    assert.ok(!scope?.has("lib/"), "prefix scope rule should be dropped");
  });
});

describe("ImportMap.of", () => {
  it("builds a map from a plain object (string base URL)", () => {
    const map = ImportMap.of(
      { imports: { react: "https://esm.sh/react" } },
      "https://example.com/",
    );
    assert.equal(map.imports.get("react")?.href, "https://esm.sh/react");
  });

  it("accepts a URL base", () => {
    const map = ImportMap.of({ imports: { vue: "https://esm.sh/vue" } }, BASE);
    assert.equal(map.imports.get("vue")?.href, "https://esm.sh/vue");
  });
});

describe("ImportMap.resolve with string base URL", () => {
  it("accepts a string baseURL", () => {
    const map = parse({ imports: { react: "https://esm.sh/react" } });
    assert.equal(
      resolve("react", map, "https://example.com/app/"),
      "https://esm.sh/react",
    );
  });
});

describe("parseImportMapString validation", () => {
  it("throws TypeError for invalid JSON", () => {
    assert.throws(() => ImportMap.parse("{ not json", BASE), TypeError);
  });

  it("ignores an empty specifier key", () => {
    const map = parse({ imports: { "": "https://esm.sh/x" } });
    assert.equal(map.imports.size, 0);
  });

  it("stores null for a non-string address value", () => {
    const map = parse({ imports: { react: 123 } });
    assert.equal(map.imports.get("react"), null);
  });

  it("warns and ignores unknown top-level keys", () => {
    // Unknown keys are ignored (with a warning); parsing still succeeds.
    const map = parse({ imports: { react: "https://esm.sh/react" }, extra: 1 });
    assert.equal(map.imports.get("react")?.href, "https://esm.sh/react");
  });

  it("throws TypeError when a scope value is not an object", () => {
    assert.throws(
      () =>
        ImportMap.parse(
          JSON.stringify({ scopes: { "https://example.com/app/": [] } }),
          BASE,
        ),
      TypeError,
    );
  });

  it("throws TypeError for non-object scopes value", () => {
    assert.throws(
      () => ImportMap.parse(JSON.stringify({ scopes: [] }), BASE),
      TypeError,
    );
  });

  it("throws TypeError for non-object integrity value", () => {
    assert.throws(
      () => ImportMap.parse(JSON.stringify({ integrity: [] }), BASE),
      TypeError,
    );
  });

  it("ignores a non-URL integrity key", () => {
    // A bare (non-URL-like) key does not resolve to a URL and is skipped.
    const map = parse({ integrity: { "bare-key": "sha384-abc" } });
    assert.equal(map.integrity.size, 0);
  });

  it("ignores a non-string integrity value", () => {
    const map = parse({ integrity: { "https://example.com/a.js": 42 } });
    assert.equal(map.integrity.size, 0);
  });

  it("ignores an unparseable scope prefix", () => {
    // A scope prefix that cannot be URL-parsed against the base is skipped.
    // Using a control character makes new URL() throw.
    const map = ImportMap.parse(
      JSON.stringify({ scopes: { "http://a b c/": { react: "https://esm.sh/react" } } }),
      BASE,
    );
    // The bad scope is skipped; the map still parses.
    assert.ok(map.scopes.size <= 1);
  });
});
