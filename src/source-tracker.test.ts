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
    assert.equal(tracker.get("ts", "https://example.com/a.ts"), "blob:null/123");
  });

  it("getSourceUrlByBlob() reverse lookup", () => {
    const tracker = new SourceTransformTracker();
    tracker.set("ts", "https://example.com/a.ts", "blob:null/123");
    assert.equal(tracker.getSourceUrlByBlob("blob:null/123"), "https://example.com/a.ts");
  });

  it("getSourceUrlByBlob() returns undefined for unknown blob", () => {
    const tracker = new SourceTransformTracker();
    assert.equal(tracker.getSourceUrlByBlob("blob:null/unknown"), undefined);
  });

  it("isInFlight() is false before runWithDedup()", () => {
    const tracker = new SourceTransformTracker();
    assert.ok(!tracker.isInFlight("ts", "https://example.com/a.ts"));
  });

  it("isInFlight() is true while task is running", async () => {
    const tracker = new SourceTransformTracker();
    let resolve!: (v: string) => void;
    const promise = new Promise<string>((res) => { resolve = res; });
    tracker.runWithDedup("ts", "https://example.com/a.ts", () => promise);
    assert.ok(tracker.isInFlight("ts", "https://example.com/a.ts"));
    resolve("blob:null/done");
    await promise;
  });

  it("isInFlight() is false after task resolves", async () => {
    const tracker = new SourceTransformTracker();
    await tracker.runWithDedup("ts", "https://example.com/a.ts", () => Promise.resolve("blob:null/x"));
    assert.ok(!tracker.isInFlight("ts", "https://example.com/a.ts"));
  });

  it("runWithDedup() returns same promise for concurrent calls", () => {
    const tracker = new SourceTransformTracker();
    let callCount = 0;
    const run = () => { callCount++; return new Promise<string>(() => {}); };
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
    assert.equal(tracker.get("css", "https://example.com/a.ts"), "blob:null/css");
  });
});
