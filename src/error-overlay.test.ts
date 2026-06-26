import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { replaceBlobUrls, extractBlobLocation, rewriteStack } from "./error-overlay.ts";
import type { ModuleTSX } from "./module-tsx.ts";

/**
 * Create a minimal mock of ModuleTSX that implements the methods used by
 * replaceBlobUrls, extractBlobLocation, and rewriteStack.
 */
function mockInstance(opts: {
  blobToSource?: Record<string, string>;
  blobToOriginal?: Record<string, string>;
}) {
  return {
    getSourceUrlByBlob(blobUrl: string): string | undefined {
      return opts.blobToSource?.[blobUrl];
    },
    getOriginalSource(blobUrl: string): string | undefined {
      return opts.blobToOriginal?.[blobUrl];
    },
  } as unknown as ModuleTSX;
}

// ─── extractBlobLocation ─────────────────────────────────────────────────────

describe("extractBlobLocation", () => {
  it("extracts blob URL with line and col from stack trace", () => {
    const blobUrl = "blob:http://localhost:3000/abc-123";
    const instance = mockInstance({ blobToSource: { [blobUrl]: "http://localhost:3000/app.tsx" } });
    const stack = `Error: something
    at App (${blobUrl}:5:12)
    at render (${blobUrl}:10:3)`;

    const result = extractBlobLocation(stack, instance);
    assert.ok(result);
    assert.equal(result!.blobUrl, blobUrl);
    assert.equal(result!.line, 5);
    assert.equal(result!.col, 12);
  });

  it("extracts blob URL with only line number", () => {
    const blobUrl = "blob:http://localhost:3000/abc-123";
    const instance = mockInstance({ blobToSource: { [blobUrl]: "http://localhost:3000/app.tsx" } });
    const stack = `Error: oops at ${blobUrl}:7`;

    const result = extractBlobLocation(stack, instance);
    assert.ok(result);
    assert.equal(result!.blobUrl, blobUrl);
    assert.equal(result!.line, 7);
  });

  it("extracts blob URL without line number", () => {
    const blobUrl = "blob:http://localhost:3000/abc-123";
    const instance = mockInstance({ blobToSource: { [blobUrl]: "http://localhost:3000/app.tsx" } });
    const stack = `Error at ${blobUrl}`;

    const result = extractBlobLocation(stack, instance);
    assert.ok(result);
    assert.equal(result!.blobUrl, blobUrl);
    assert.equal(result!.line, 1);
  });

  it("returns undefined when no blob URL is recognized", () => {
    const instance = mockInstance({ blobToSource: {} });
    const stack = `Error: something\n    at foo (http://localhost/app.js:5:12)`;

    const result = extractBlobLocation(stack, instance);
    assert.equal(result, undefined);
  });

  it("returns undefined for empty stack", () => {
    const instance = mockInstance({ blobToSource: {} });
    const result = extractBlobLocation("", instance);
    assert.equal(result, undefined);
  });

  it("handles https blob URLs", () => {
    const blobUrl = "blob:https://example.com/def-456";
    const instance = mockInstance({ blobToSource: { [blobUrl]: "https://example.com/main.ts" } });
    const stack = `    at ${blobUrl}:3:1`;

    const result = extractBlobLocation(stack, instance);
    assert.ok(result);
    assert.equal(result!.blobUrl, blobUrl);
    assert.equal(result!.line, 3);
    assert.equal(result!.col, 1);
  });
});

// ─── replaceBlobUrls ─────────────────────────────────────────────────────────

describe("replaceBlobUrls", () => {
  it("replaces blob URL without line number", async () => {
    const blobUrl = "blob:http://localhost:3000/abc-123";
    const instance = mockInstance({ blobToSource: { [blobUrl]: "http://localhost:3000/app.tsx" } });

    const result = await replaceBlobUrls(`Error at ${blobUrl}`, instance);
    assert.equal(result, "Error at http://localhost:3000/app.tsx");
  });

  it("replaces blob URL with line:col using source map", async () => {
    const blobUrl = "blob:http://localhost:3000/abc-123";
    const originalSource = `const x = 1;\nconsole.log(x);\n`;
    const instance = mockInstance({
      blobToSource: { [blobUrl]: "http://localhost:3000/app.ts" },
      blobToOriginal: { [blobUrl]: originalSource },
    });

    // Line 3 in compiled = line 2 of source (after subtracting import.meta.url line)
    const result = await replaceBlobUrls(`Error at ${blobUrl}:3:1`, instance);
    // Should use source map resolution - expect mapped line
    assert.ok(result.includes("http://localhost:3000/app.ts:"), result);
    assert.ok(!result.includes("blob:"), `should not contain blob URL: ${result}`);
  });

  it("falls back to -1 adjustment when no original source available", async () => {
    const blobUrl = "blob:http://localhost:3000/abc-123";
    const instance = mockInstance({
      blobToSource: { [blobUrl]: "http://localhost:3000/app.ts" },
      blobToOriginal: {}, // no original source
    });

    const result = await replaceBlobUrls(`at ${blobUrl}:5:10`, instance);
    assert.equal(result, "at http://localhost:3000/app.ts:4:10");
  });

  it("returns text unchanged when no blob URLs are present", async () => {
    const instance = mockInstance({ blobToSource: {} });
    const text = "Error: something went wrong at http://localhost/app.js:5:12";
    const result = await replaceBlobUrls(text, instance);
    assert.equal(result, text);
  });

  it("returns text unchanged when blob URL is not recognized", async () => {
    const instance = mockInstance({ blobToSource: {} });
    const text = "Error at blob:http://localhost:3000/unknown-uuid:5:12";
    const result = await replaceBlobUrls(text, instance);
    assert.equal(result, text);
  });

  it("handles multiple blob URLs in the same text", async () => {
    const blob1 = "blob:http://localhost:3000/aaa";
    const blob2 = "blob:http://localhost:3000/bbb";
    const instance = mockInstance({
      blobToSource: {
        [blob1]: "http://localhost:3000/a.ts",
        [blob2]: "http://localhost:3000/b.ts",
      },
    });

    const text = `first ${blob1} and second ${blob2}`;
    const result = await replaceBlobUrls(text, instance);
    assert.ok(result.includes("http://localhost:3000/a.ts"), result);
    assert.ok(result.includes("http://localhost:3000/b.ts"), result);
    assert.ok(!result.includes("blob:"), result);
  });

  it("handles single trailing number as line number", async () => {
    const blobUrl = "blob:http://localhost:3000/abc-123";
    const instance = mockInstance({
      blobToSource: { [blobUrl]: "http://localhost:3000/app.ts" },
      blobToOriginal: {}, // no original source for fallback path
    });

    // When the blob URL has only one trailing number, it's treated as a line
    // But first the code tries to match the blob URL with the number stripped
    // If blob:http://localhost:3000/abc-123 is in the map, then :5 is col (single number case)
    const result = await replaceBlobUrls(`at ${blobUrl}:5`, instance);
    // Single trailing number treated as line, adjusted -1
    assert.equal(result, "at http://localhost:3000/app.ts:4");
  });
});

// ─── rewriteStack ────────────────────────────────────────────────────────────

describe("rewriteStack", () => {
  it("rewrites blob URLs in stack trace using source maps", async () => {
    const blobUrl = "blob:http://localhost:3000/abc-123";
    const originalSource = `const x = 1;\nconsole.log(x);\n`;
    const instance = mockInstance({
      blobToSource: { [blobUrl]: "http://localhost:3000/app.ts" },
      blobToOriginal: { [blobUrl]: originalSource },
    });

    const stack = `Error: boom\n    at foo (${blobUrl}:3:1)`;
    const result = await rewriteStack(stack, instance);
    assert.ok(result.includes("http://localhost:3000/app.ts:"), result);
    assert.ok(!result.includes("blob:"), `should not contain blob URL: ${result}`);
  });

  it("returns stack unchanged when no blob URLs present", async () => {
    const instance = mockInstance({ blobToSource: {} });
    const stack = `Error: boom\n    at foo (http://localhost/app.js:5:12)`;
    const result = await rewriteStack(stack, instance);
    assert.equal(result, stack);
  });

  it("falls back to -1 adjustment when source map fails", async () => {
    const blobUrl = "blob:http://localhost:3000/abc-123";
    const instance = mockInstance({
      blobToSource: { [blobUrl]: "http://localhost:3000/app.ts" },
      blobToOriginal: {}, // no original source
    });

    const stack = `    at bar (${blobUrl}:10:5)`;
    const result = await rewriteStack(stack, instance);
    assert.equal(result, "    at bar (http://localhost:3000/app.ts:9:5)");
  });

  it("handles multiple blob URLs in stack", async () => {
    const blob1 = "blob:http://localhost:3000/aaa";
    const blob2 = "blob:http://localhost:3000/bbb";
    const instance = mockInstance({
      blobToSource: {
        [blob1]: "http://localhost:3000/a.ts",
        [blob2]: "http://localhost:3000/b.ts",
      },
    });

    const stack = `    at foo (${blob1}:5:1)\n    at bar (${blob2}:3:1)`;
    const result = await rewriteStack(stack, instance);
    assert.ok(result.includes("http://localhost:3000/a.ts:4:1"), result);
    assert.ok(result.includes("http://localhost:3000/b.ts:2:1"), result);
    assert.ok(!result.includes("blob:"), result);
  });

  it("rewrites blob URL without line number", async () => {
    const blobUrl = "blob:http://localhost:3000/abc-123";
    const instance = mockInstance({
      blobToSource: { [blobUrl]: "http://localhost:3000/app.ts" },
    });

    const stack = `    at ${blobUrl}`;
    const result = await rewriteStack(stack, instance);
    assert.equal(result, "    at http://localhost:3000/app.ts");
  });

  it("preserves non-blob parts of the stack trace", async () => {
    const blobUrl = "blob:http://localhost:3000/abc-123";
    const instance = mockInstance({
      blobToSource: { [blobUrl]: "http://localhost:3000/app.ts" },
    });

    const stack = `TypeError: Cannot read property 'foo' of undefined\n    at Object.bar (${blobUrl}:5:3)\n    at native code`;
    const result = await rewriteStack(stack, instance);
    assert.ok(result.startsWith("TypeError: Cannot read property 'foo' of undefined"), result);
    assert.ok(result.includes("at native code"), result);
  });
});
