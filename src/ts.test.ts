import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSourceFile, printSourceFile, transform } from "./ts.ts";
import ts from "typescript";

describe("createSourceFile", () => {
  it("parses valid TypeScript", () => {
    const sf = createSourceFile(`const x: number = 1;`, "test.ts");
    assert.equal(sf.fileName, "test.ts");
  });

  it("parses TSX syntax", () => {
    assert.doesNotThrow(() =>
      createSourceFile(`const el = <div />;`, "test.tsx")
    );
  });
});

describe("printSourceFile", () => {
  it("strips TypeScript type annotations", () => {
    const sf = createSourceFile(`const x: number = 42;`, "test.ts");
    const out = printSourceFile(sf);
    assert.ok(!out.includes(": number"), out);
    assert.ok(out.includes("42"), out);
  });

  it("transpiles TSX to React.createElement calls", () => {
    const sf = createSourceFile(
      `import React from "react";\nconsole.log(React);\nconst el = <div className="x" />;`,
      "test.tsx",
    );
    const out = printSourceFile(sf);
    assert.ok(out.includes("React.createElement"), out);
  });

  it("preserves side-effect ESM import statements", () => {
    const sf = createSourceFile(`import "some-lib";`, "test.ts");
    const out = printSourceFile(sf);
    assert.ok(out.includes("some-lib"), out);
  });
});

describe("transform", () => {
  it("applies a transformer to the source file", () => {
    const sf = createSourceFile(`const x = 1;`, "test.ts");
    let visited = false;
    const noop: ts.TransformerFactory<ts.SourceFile> = (ctx) => (node) => {
      visited = true;
      return ts.visitEachChild(node, (n) => n, ctx);
    };
    transform(sf, [noop]);
    assert.ok(visited);
  });

  it("returns a SourceFile", () => {
    const sf = createSourceFile(`const x = 1;`, "test.ts");
    const result = transform(sf, []);
    assert.ok(result && typeof result.fileName === "string");
  });
});
