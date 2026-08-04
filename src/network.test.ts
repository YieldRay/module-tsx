import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fetchResponse } from "./network.ts";
import { ModuleTSXError } from "./error.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("fetchResponse", () => {
  it("returns the response on a successful (ok) fetch", async () => {
    const expected = new Response("ok", { status: 200 });
    globalThis.fetch = async () => expected;

    const res = await fetchResponse("https://example.com/a.js");
    assert.equal(res, expected);
  });

  it("wraps a network error in a ModuleTSXError with the URL and cause", async () => {
    const cause = new Error("boom");
    globalThis.fetch = async () => {
      throw cause;
    };

    await assert.rejects(
      () => fetchResponse("https://example.com/a.js"),
      (err: unknown) => {
        assert.ok(err instanceof ModuleTSXError);
        assert.match(err.message, /https:\/\/example\.com\/a\.js/);
        assert.match(err.message, /Network error/);
        assert.equal((err as ModuleTSXError).cause, cause);
        return true;
      },
    );
  });

  it("throws a ModuleTSXError with status text for a non-ok response", async () => {
    globalThis.fetch = async () => new Response("nope", { status: 404, statusText: "Not Found" });

    await assert.rejects(
      () => fetchResponse("https://example.com/missing.js"),
      (err: unknown) => {
        assert.ok(err instanceof ModuleTSXError);
        assert.match(err.message, /404/);
        assert.match(err.message, /Not Found/);
        return true;
      },
    );
  });

  it("derives the URL from a Request input", async () => {
    globalThis.fetch = async () => {
      throw new Error("boom");
    };

    await assert.rejects(
      () => fetchResponse(new Request("https://example.com/from-request.js")),
      (err: unknown) => {
        assert.ok(err instanceof ModuleTSXError);
        assert.match(err.message, /from-request\.js/);
        return true;
      },
    );
  });
});
