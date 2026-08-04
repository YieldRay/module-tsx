import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SourceTransformTracker } from "./source-tracker.ts";

describe("SourceTransformTracker", () => {
  it("get() returns undefined before set()", () => {
    const tracker = new SourceTransformTracker();
    assert.equal(tracker.get("ts", "https://example.com/a.ts"), undefined);
  });

  it("set() and get() round-trip", () => {
    const tracker = new SourceTransformTracker();
    tracker.set("ts", "https://example.com/a.ts", "blob:null/123");
    assert.equal(
      tracker.get("ts", "https://example.com/a.ts"),
      "blob:null/123",
    );
  });

  it("getSourceUrlByBlob() reverse lookup", () => {
    const tracker = new SourceTransformTracker();
    tracker.set("ts", "https://example.com/a.ts", "blob:null/123");
    assert.equal(
      tracker.getSourceUrlByBlob("blob:null/123"),
      "https://example.com/a.ts",
    );
  });

  it("getSourceUrlByBlob() returns undefined for unknown blob", () => {
    const tracker = new SourceTransformTracker();
    assert.equal(tracker.getSourceUrlByBlob("blob:null/unknown"), undefined);
  });

  it("runWithDedup() reuses the in-flight task while it is running", async () => {
    const tracker = new SourceTransformTracker();
    let calls = 0;
    let resolve!: (v: string) => void;
    const promise = new Promise<string>((res) => {
      resolve = res;
    });
    const run = () => {
      calls++;
      return promise;
    };

    const p1 = tracker.runWithDedup("ts", "https://example.com/a.ts", run);
    // A second call while the first is running must reuse it, not start again.
    const p2 = tracker.runWithDedup("ts", "https://example.com/a.ts", run);
    assert.equal(p1, p2);
    assert.equal(calls, 1);

    resolve("blob:null/done");
    await promise;
  });

  it("runWithDedup() runs again after the previous task resolves", async () => {
    const tracker = new SourceTransformTracker();
    let calls = 0;
    const run = () => {
      calls++;
      return Promise.resolve("blob:null/x");
    };

    await tracker.runWithDedup("ts", "https://example.com/a.ts", run);
    // Once finished, the entry is no longer in flight, so a fresh call re-runs.
    await tracker.runWithDedup("ts", "https://example.com/a.ts", run);
    assert.equal(calls, 2);
  });

  it("runWithDedup() returns same promise for concurrent calls", () => {
    const tracker = new SourceTransformTracker();
    let callCount = 0;
    const run = () => {
      callCount++;
      return new Promise<string>(() => {});
    };
    const p1 = tracker.runWithDedup("ts", "https://example.com/a.ts", run);
    const p2 = tracker.runWithDedup("ts", "https://example.com/a.ts", run);
    assert.equal(p1, p2);
    assert.equal(callCount, 1);
  });

  it("different sourceType keys are independent", () => {
    const tracker = new SourceTransformTracker();
    tracker.set("ts", "https://example.com/a.ts", "blob:null/ts");
    tracker.set("css", "https://example.com/a.ts", "blob:null/css");
    assert.equal(tracker.get("ts", "https://example.com/a.ts"), "blob:null/ts");
    assert.equal(
      tracker.get("css", "https://example.com/a.ts"),
      "blob:null/css",
    );
  });
});
