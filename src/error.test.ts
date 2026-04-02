import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ModuleTSXError, warn } from "./error.ts";

describe("ModuleTSXError", () => {
  it("is an instance of Error", () => {
    const err = new ModuleTSXError("oops");
    assert.ok(err instanceof Error);
    assert.ok(err instanceof ModuleTSXError);
  });

  it("has name ModuleTSXError", () => {
    assert.equal(new ModuleTSXError("x").name, "ModuleTSXError");
  });

  it("preserves message", () => {
    assert.equal(new ModuleTSXError("hello").message, "hello");
  });

  it("supports cause via ErrorOptions", () => {
    const cause = new Error("root");
    const err = new ModuleTSXError("wrapped", { cause });
    assert.equal((err as any).cause, cause);
  });
});

describe("warn", () => {
  it("does not throw", () => {
    assert.doesNotThrow(() => warn("test message", 1, 2));
  });
});
