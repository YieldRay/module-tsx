import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { ModuleTSX } from "./module-tsx.ts";
import { ImportMap } from "./import-map.ts";

// URL.createObjectURL returns blob: URLs which Node's ESM loader doesn't support.
// patchBlobToDataUrl() replaces it with a registry that stores blob content keyed
// by a fake blob: key, letting tests inspect transformed output.
function patchBlobToDataUrl() {
  const pending = new Map<string, Promise<string>>();
  let n = 0;
  (URL as any).createObjectURL = (blob: Blob) => {
    const key = `blob:test/${++n}`;
    pending.set(key, blob.text());
    return key;
  };
  (URL as any).revokeObjectURL = () => {};
  return pending;
}

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

before(() => {
  (URL as any).createObjectURL = () => {
    throw new Error("createObjectURL called without patchBlobToDataUrl()");
  };
});

after(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

/** A fake fetch that serves an in-memory map of url → source code. */
function makeFetch(files: Record<string, string>) {
  return async (url: string): Promise<Response> => {
    const body = files[url];
    if (body === undefined) throw new Error(`fetch: 404 ${url}`);
    return new Response(body, { status: 200 });
  };
}

const BASE = "https://example.com/";

function parseMap(json: object, base = BASE) {
  return ImportMap.parse(JSON.stringify(json), new URL(base));
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe("ModuleTSX constructor", () => {
  it("uses provided baseUrl", () => {
    const m = new ModuleTSX({ baseUrl: BASE, fetch: makeFetch({}) });
    assert.equal(m.baseUrl, BASE);
  });

  it("uses provided importMap", () => {
    const importMap = parseMap({ imports: { react: "https://esm.sh/react" } });
    const m = new ModuleTSX({ baseUrl: BASE, importMap, fetch: makeFetch({}) });
    assert.equal(m.importMap, importMap);
  });

  it("uses provided fetch function", () => {
    const myFetch = makeFetch({});
    const m = new ModuleTSX({ baseUrl: BASE, fetch: myFetch });
    assert.equal(m.fetch, myFetch);
  });

  it("uses string resolveBareSpecifier as prefix", () => {
    const m = new ModuleTSX({
      baseUrl: BASE,
      fetch: makeFetch({}),
      resolveBareSpecifier: "https://cdn.jsdelivr.net/npm/",
    });
    assert.equal(
      m.resolveBareSpecifier("react"),
      "https://cdn.jsdelivr.net/npm/react",
    );
  });

  it("uses function resolveBareSpecifier", () => {
    const m = new ModuleTSX({
      baseUrl: BASE,
      fetch: makeFetch({}),
      resolveBareSpecifier: (s) => `https://custom.cdn/${s}`,
    });
    assert.equal(m.resolveBareSpecifier("react"), "https://custom.cdn/react");
  });
});

describe("ModuleTSX events", () => {
  it("emits 'import' event when import() is called", async () => {
    const m = new ModuleTSX({
      baseUrl: BASE,
      fetch: async () => {
        throw new Error("network error");
      },
    });

    const events: string[] = [];
    m.addEventListener("import", (e) =>
      events.push((e as CustomEvent).detail.id),
    );
    m.addEventListener("import:error", () => {}); // suppress unhandled rejection

    await m.import("react").catch(() => {});
    assert.ok(events.includes("react"));
  });

  it("emits 'import:error' event when fetch fails", async () => {
    const m = new ModuleTSX({
      baseUrl: BASE,
      fetch: async () => {
        throw new Error("network error");
      },
    });

    let errorDetail: any;
    m.addEventListener("import:error", (e) => {
      errorDetail = (e as CustomEvent).detail;
    });

    await m.import("react").catch(() => {});
    assert.ok(errorDetail);
    assert.equal(errorDetail.id, "https://esm.sh/react");
  });

  it("emits 'transform' event during importCode()", async () => {
    patchBlobToDataUrl();

    const events: string[] = [];
    const m = new ModuleTSX({
      baseUrl: BASE,
      fetch: makeFetch({}),
    });
    m.addEventListener("transform", (e) =>
      events.push((e as CustomEvent).detail.sourceUrl),
    );

    await m
      .importCode("https://example.com/app.ts", `export const x = 1;`)
      .catch(() => {});
    assert.ok(events.includes("https://example.com/app.ts"));
  });
});

describe("ModuleTSX specifier resolution via fetch tracking", () => {
  it("resolves bare specifier to esm.sh by default", async () => {
    const fetched: string[] = [];
    const m = new ModuleTSX({
      baseUrl: BASE,
      fetch: async (url) => {
        fetched.push(url);
        throw new Error("stop");
      },
    });

    await m.import("react").catch(() => {});
    assert.ok(fetched.includes("https://esm.sh/react"), `fetched: ${fetched}`);
  });

  it("resolves bare specifier via importMap before esm.sh", async () => {
    const fetched: string[] = [];
    const m = new ModuleTSX({
      baseUrl: BASE,
      importMap: parseMap({
        imports: { react: "https://cdn.example.com/react.js" },
      }),
      fetch: async (url) => {
        fetched.push(url);
        throw new Error("stop");
      },
    });

    await m.import("react").catch(() => {});
    assert.ok(
      fetched.includes("https://cdn.example.com/react.js"),
      `fetched: ${fetched}`,
    );
    assert.ok(
      !fetched.some((u) => u.includes("esm.sh")),
      `should not hit esm.sh`,
    );
  });

  it("resolves relative specifier against baseUrl", async () => {
    const fetched: string[] = [];
    const m = new ModuleTSX({
      baseUrl: "https://example.com/app/",
      fetch: async (url) => {
        fetched.push(url);
        throw new Error("stop");
      },
    });

    await m.import("./utils.ts").catch(() => {});
    assert.ok(
      fetched.includes("https://example.com/app/utils.ts"),
      `fetched: ${fetched}`,
    );
  });

  it("uses custom resolveBareSpecifier string prefix", async () => {
    const fetched: string[] = [];
    const m = new ModuleTSX({
      baseUrl: BASE,
      fetch: async (url) => {
        fetched.push(url);
        throw new Error("stop");
      },
      resolveBareSpecifier: "https://jspm.dev/",
    });

    await m.import("lodash").catch(() => {});
    assert.ok(
      fetched.includes("https://jspm.dev/lodash"),
      `fetched: ${fetched}`,
    );
  });

  it("uses custom resolveBareSpecifier function", async () => {
    const fetched: string[] = [];
    const m = new ModuleTSX({
      baseUrl: BASE,
      fetch: async (url) => {
        fetched.push(url);
        throw new Error("stop");
      },
      resolveBareSpecifier: (s) => `https://my-cdn.io/${s}@latest`,
    });

    await m.import("vue").catch(() => {});
    assert.ok(
      fetched.includes("https://my-cdn.io/vue@latest"),
      `fetched: ${fetched}`,
    );
  });
});

describe("ModuleTSX importCode end-to-end", () => {
  it("transpiles TypeScript and returns module exports", async () => {
    const pending = patchBlobToDataUrl();

    const m = new ModuleTSX({
      baseUrl: BASE,
      fetch: makeFetch({}),
    });

    await m
      .importCode(
        "https://example.com/app.ts",
        `export const answer: number = 42;`,
      )
      .catch(() => {});

    const [key] = pending.keys();
    assert.ok(key, "createObjectURL should have been called");
    const text = await pending.get(key)!;
    assert.ok(text.includes("42"), text);
    assert.ok(!text.includes(": number"), text);
  });

  it("rewrites bare specifier imports in transformed output", async () => {
    const pending = patchBlobToDataUrl();

    const m = new ModuleTSX({
      baseUrl: BASE,
      importMap: parseMap({
        imports: { react: "https://cdn.example.com/react.js" },
      }),
      fetch: makeFetch({}),
    });

    await m
      .importCode(
        "https://example.com/app.tsx",
        `import React from "react";\nconsole.log(React);`,
      )
      .catch(() => {});

    const [key] = pending.keys();
    const text = await pending.get(key)!;
    assert.ok(text.includes("https://cdn.example.com/react.js"), text);
    assert.ok(!text.includes('"react"'), text);
  });

  it("resolves node: specifiers to the jspm polyfill by default", async () => {
    const pending = patchBlobToDataUrl();

    const m = new ModuleTSX({ baseUrl: BASE, fetch: makeFetch({}) });

    await m
      .importCode(
        "https://example.com/app.ts",
        `import { readFileSync } from "node:fs";\nconsole.log(readFileSync);`,
      )
      .catch(() => {});

    const [key] = pending.keys();
    const text = await pending.get(key)!;
    assert.ok(
      text.includes("@jspm/core/nodelibs/browser/fs.js"),
      text,
    );
    assert.ok(!text.includes('"node:fs"'), text);
  });

  it("lets the import map override a node: specifier before the jspm fallback", async () => {
    const pending = patchBlobToDataUrl();

    const m = new ModuleTSX({
      baseUrl: BASE,
      importMap: parseMap({
        imports: { "node:fs": "https://cdn.example.com/fs-shim.js" },
      }),
      fetch: makeFetch({}),
    });

    await m
      .importCode(
        "https://example.com/app.ts",
        `import { readFileSync } from "node:fs";\nconsole.log(readFileSync);`,
      )
      .catch(() => {});

    const [key] = pending.keys();
    const text = await pending.get(key)!;
    assert.ok(text.includes("https://cdn.example.com/fs-shim.js"), text);
    assert.ok(!text.includes("@jspm/core"), text);
  });

  it("auto-injects React import when JSX is used", async () => {
    const pending = patchBlobToDataUrl();

    const m = new ModuleTSX({
      baseUrl: BASE,
      fetch: makeFetch({}),
    });

    await m
      .importCode("https://example.com/app.tsx", `const el = <div />;`)
      .catch(() => {});

    const [key] = pending.keys();
    const text = await pending.get(key)!;
    assert.ok(text.includes("React.createElement"), text);
  });

  it("fetches and transforms transitive relative imports", async () => {
    const pending = patchBlobToDataUrl();
    const fetched: string[] = [];

    const files = {
      "https://example.com/app.ts": `import { msg } from "./msg.ts";\nconsole.log(msg);`,
      "https://example.com/msg.ts": `export const msg: string = "hello";`,
    };

    const m = new ModuleTSX({
      baseUrl: BASE,
      fetch: async (url) => {
        fetched.push(url);
        return makeFetch(files)(url);
      },
    });

    await m
      .importCode(
        "https://example.com/app.ts",
        files["https://example.com/app.ts"],
      )
      .catch(() => {});

    assert.ok(
      fetched.includes("https://example.com/msg.ts"),
      `fetched: ${fetched}`,
    );

    const texts = await Promise.all([...pending.values()]);
    const appText = texts.find((t) => t.includes("msg"));
    assert.ok(appText, "app blob should reference msg");
    assert.ok(
      !appText.includes('"./msg.ts"'),
      `should rewrite relative import, got: ${appText}`,
    );
  });

  it("rewrites a shared (diamond) relative import to a blob URL, not a raw URL", async () => {
    // app.tsx imports b.tsx and c.tsx, and both of them import shared.ts.
    // Because b.tsx and c.tsx are transformed at the same time, they both reach
    // shared.ts while it is still being transformed. This is not a cycle, so
    // both must end up pointing at shared.ts's blob URL. If either points at the
    // raw .ts URL, the browser cannot run it.
    const pending = patchBlobToDataUrl();

    const files: Record<string, string> = {
      "https://example.com/app.tsx": `import { b } from "./b.tsx";\nimport { c } from "./c.tsx";\nconsole.log(b, c);`,
      "https://example.com/b.tsx": `import { shared } from "./shared.ts";\nexport const b = shared;`,
      "https://example.com/c.tsx": `import { shared } from "./shared.ts";\nexport const c = shared;`,
      "https://example.com/shared.ts": `export const shared: number = 1;`,
    };

    // A slow fetch keeps shared.ts "in flight" long enough that b.tsx and c.tsx
    // both request it before it finishes transforming.
    const m = new ModuleTSX({
      baseUrl: BASE,
      fetch: async (url) => {
        await new Promise((r) => setTimeout(r, 5));
        return makeFetch(files)(url);
      },
    });

    await m
      .importCode("https://example.com/app.tsx", files["https://example.com/app.tsx"])
      .catch(() => {});

    const texts = await Promise.all([...pending.values()]);

    for (const label of ["b", "c"]) {
      const text = texts.find((t) => t.includes(`export const ${label}`));
      assert.ok(text, `${label}.tsx blob should exist`);
      assert.ok(
        !text.includes('"./shared.ts"'),
        `${label}.tsx should rewrite ./shared.ts, got: ${text}`,
      );
      assert.ok(
        !text.includes("https://example.com/shared.ts"),
        `${label}.tsx must not reference the raw .ts URL, got: ${text}`,
      );
    }
  });

  it("does not deadlock on a genuine import cycle", async () => {
    // a.ts and b.ts import each other. When b.ts asks for a.ts, a.ts is still
    // being transformed higher up the chain, so we fall back to the raw URL and
    // let the browser link the cycle. The point of this test is that the whole
    // thing finishes instead of hanging.
    const pending = patchBlobToDataUrl();

    const files: Record<string, string> = {
      "https://example.com/a.ts": `import { b } from "./b.ts";\nexport const a = 1;\nexport const usesB = () => b;`,
      "https://example.com/b.ts": `import { a } from "./a.ts";\nexport const b = 2;\nexport const usesA = () => a;`,
    };

    const m = new ModuleTSX({ baseUrl: BASE, fetch: makeFetch(files) });

    await m
      .importCode("https://example.com/a.ts", files["https://example.com/a.ts"])
      .catch(() => {});

    // Both modules must have been transformed (i.e. no deadlock stalled either).
    const texts = await Promise.all([...pending.values()]);
    assert.ok(
      texts.some((t) => t.includes("export const a")),
      "a.ts should have been transformed",
    );
    assert.ok(
      texts.some((t) => t.includes("export const b")),
      "b.ts should have been transformed",
    );
  });

  it("deduplicates concurrent importCode calls for the same URL", async () => {
    patchBlobToDataUrl();
    let transformCount = 0;

    const m = new ModuleTSX({
      baseUrl: BASE,
      fetch: makeFetch({}),
    });

    m.addEventListener("transform", () => {
      transformCount++;
    });

    const code = `export const x = 1;`;
    const url = "https://example.com/app.ts";

    await Promise.allSettled([
      m.importCode(url, code),
      m.importCode(url, code),
    ]);

    assert.equal(
      transformCount,
      1,
      `transform fired ${transformCount} times, expected 1`,
    );
  });
});
