import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { ModuleTSX } from "./module-tsx.ts";

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

// ─── tests ───────────────────────────────────────────────────────────────────

describe("ModuleTSX constructor", () => {
  it("uses provided baseUrl", () => {
    const m = new ModuleTSX({ baseUrl: "https://example.com/", importMap: {}, fetch: makeFetch({}) });
    assert.equal(m.baseUrl, "https://example.com/");
  });

  it("uses provided importMap", () => {
    const importMap = { imports: { react: "https://esm.sh/react" } };
    const m = new ModuleTSX({ baseUrl: "https://example.com/", importMap, fetch: makeFetch({}) });
    assert.deepEqual(m.importMap, importMap);
  });

  it("uses provided fetch function", () => {
    const myFetch = makeFetch({});
    const m = new ModuleTSX({ baseUrl: "https://example.com/", importMap: {}, fetch: myFetch });
    assert.equal(m.fetch, myFetch);
  });

  it("uses string resolveBareSpecifier as prefix", () => {
    const m = new ModuleTSX({
      baseUrl: "https://example.com/",
      importMap: {},
      fetch: makeFetch({}),
      resolveBareSpecifier: "https://cdn.jsdelivr.net/npm/",
    });
    assert.equal(m.resolveBareSpecifier("react"), "https://cdn.jsdelivr.net/npm/react");
  });

  it("uses function resolveBareSpecifier", () => {
    const m = new ModuleTSX({
      baseUrl: "https://example.com/",
      importMap: {},
      fetch: makeFetch({}),
      resolveBareSpecifier: (s) => `https://custom.cdn/${s}`,
    });
    assert.equal(m.resolveBareSpecifier("react"), "https://custom.cdn/react");
  });
});

describe("ModuleTSX events", () => {
  it("emits 'import' event when import() is called", async () => {
    const m = new ModuleTSX({
      baseUrl: "https://example.com/",
      importMap: {},
      fetch: async () => { throw new Error("network error"); },
    });

    const events: string[] = [];
    m.addEventListener("import", (e) => events.push((e as CustomEvent).detail.id));
    m.addEventListener("import:error", () => {}); // suppress unhandled rejection

    await m.import("react").catch(() => {});
    assert.ok(events.includes("react"));
  });

  it("emits 'import:error' event when fetch fails", async () => {
    const m = new ModuleTSX({
      baseUrl: "https://example.com/",
      importMap: {},
      fetch: async () => { throw new Error("network error"); },
    });

    let errorDetail: any;
    m.addEventListener("import:error", (e) => { errorDetail = (e as CustomEvent).detail; });

    await m.import("react").catch(() => {});
    assert.ok(errorDetail);
    assert.equal(errorDetail.id, "https://esm.sh/react");
  });

  it("emits 'transform' event during importCode()", async () => {
    patchBlobToDataUrl();

    const events: string[] = [];
    const m = new ModuleTSX({
      baseUrl: "https://example.com/",
      importMap: {},
      fetch: makeFetch({}),
    });
    m.addEventListener("transform", (e) => events.push((e as CustomEvent).detail.sourceUrl));

    await m.importCode("https://example.com/app.ts", `export const x = 1;`).catch(() => {});
    assert.ok(events.includes("https://example.com/app.ts"));
  });
});

describe("ModuleTSX specifier resolution via fetch tracking", () => {
  it("resolves bare specifier to esm.sh by default", async () => {
    const fetched: string[] = [];
    const m = new ModuleTSX({
      baseUrl: "https://example.com/",
      importMap: {},
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
      baseUrl: "https://example.com/",
      importMap: { imports: { react: "https://cdn.example.com/react.js" } },
      fetch: async (url) => {
        fetched.push(url);
        throw new Error("stop");
      },
    });

    await m.import("react").catch(() => {});
    assert.ok(fetched.includes("https://cdn.example.com/react.js"), `fetched: ${fetched}`);
    assert.ok(!fetched.some((u) => u.includes("esm.sh")), `should not hit esm.sh`);
  });

  it("resolves relative specifier against baseUrl", async () => {
    const fetched: string[] = [];
    const m = new ModuleTSX({
      baseUrl: "https://example.com/app/",
      importMap: {},
      fetch: async (url) => {
        fetched.push(url);
        throw new Error("stop");
      },
    });

    await m.import("./utils.ts").catch(() => {});
    assert.ok(fetched.includes("https://example.com/app/utils.ts"), `fetched: ${fetched}`);
  });

  it("uses custom resolveBareSpecifier string prefix", async () => {
    const fetched: string[] = [];
    const m = new ModuleTSX({
      baseUrl: "https://example.com/",
      importMap: {},
      fetch: async (url) => {
        fetched.push(url);
        throw new Error("stop");
      },
      resolveBareSpecifier: "https://jspm.dev/",
    });

    await m.import("lodash").catch(() => {});
    assert.ok(fetched.includes("https://jspm.dev/lodash"), `fetched: ${fetched}`);
  });

  it("uses custom resolveBareSpecifier function", async () => {
    const fetched: string[] = [];
    const m = new ModuleTSX({
      baseUrl: "https://example.com/",
      importMap: {},
      fetch: async (url) => {
        fetched.push(url);
        throw new Error("stop");
      },
      resolveBareSpecifier: (s) => `https://my-cdn.io/${s}@latest`,
    });

    await m.import("vue").catch(() => {});
    assert.ok(fetched.includes("https://my-cdn.io/vue@latest"), `fetched: ${fetched}`);
  });
});

describe("ModuleTSX importCode end-to-end", () => {
  it("transpiles TypeScript and returns module exports", async () => {
    const pending = patchBlobToDataUrl();

    const m = new ModuleTSX({
      baseUrl: "https://example.com/",
      importMap: {},
      fetch: makeFetch({}),
    });

    await m.importCode("https://example.com/app.ts", `export const answer: number = 42;`).catch(() => {});

    const [key] = pending.keys();
    assert.ok(key, "createObjectURL should have been called");
    const text = await pending.get(key)!;
    assert.ok(text.includes("42"), text);
    assert.ok(!text.includes(": number"), text);
  });

  it("rewrites bare specifier imports in transformed output", async () => {
    const pending = patchBlobToDataUrl();

    const m = new ModuleTSX({
      baseUrl: "https://example.com/",
      importMap: { imports: { react: "https://cdn.example.com/react.js" } },
      fetch: makeFetch({}),
    });

    await m.importCode("https://example.com/app.tsx", `import React from "react";\nconsole.log(React);`).catch(() => {});

    const [key] = pending.keys();
    const text = await pending.get(key)!;
    assert.ok(text.includes("https://cdn.example.com/react.js"), text);
    assert.ok(!text.includes('"react"'), text);
  });

  it("auto-injects React import when JSX is used", async () => {
    const pending = patchBlobToDataUrl();

    const m = new ModuleTSX({
      baseUrl: "https://example.com/",
      importMap: {},
      fetch: makeFetch({}),
    });

    await m.importCode("https://example.com/app.tsx", `const el = <div />;`).catch(() => {});

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
      baseUrl: "https://example.com/",
      importMap: {},
      fetch: async (url) => {
        fetched.push(url);
        return makeFetch(files)(url);
      },
    });

    await m.importCode("https://example.com/app.ts", files["https://example.com/app.ts"]).catch(() => {});

    assert.ok(fetched.includes("https://example.com/msg.ts"), `fetched: ${fetched}`);

    const texts = await Promise.all([...pending.values()]);
    const appText = texts.find((t) => t.includes("msg"));
    assert.ok(appText, "app blob should reference msg");
    assert.ok(!appText.includes('"./msg.ts"'), `should rewrite relative import, got: ${appText}`);
  });

  it("deduplicates concurrent importCode calls for the same URL", async () => {
    patchBlobToDataUrl();
    let transformCount = 0;

    const m = new ModuleTSX({
      baseUrl: "https://example.com/",
      importMap: {},
      fetch: makeFetch({}),
    });

    m.addEventListener("transform", () => { transformCount++; });

    const code = `export const x = 1;`;
    const url = "https://example.com/app.ts";

    await Promise.allSettled([
      m.importCode(url, code),
      m.importCode(url, code),
    ]);

    assert.equal(transformCount, 1, `transform fired ${transformCount} times, expected 1`);
  });
});
