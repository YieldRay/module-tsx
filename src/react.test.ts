import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { needsReactImport, addReactImport } from "./react.ts";
import { createSourceFile, printSourceFile } from "./ts.ts";

describe("needsReactImport", () => {
  it("returns true when JSX is used without React import", () => {
    const sf = createSourceFile(`const el = <div />;`, "test.tsx");
    assert.ok(needsReactImport(sf));
  });

  it("returns false when React is already default-imported", () => {
    const sf = createSourceFile(
      `import React from "react";\nconst el = <div />;`,
      "test.tsx",
    );
    assert.ok(!needsReactImport(sf));
  });

  it("returns false when React is namespace-imported", () => {
    const sf = createSourceFile(
      `import * as React from "react";\nconst el = <div />;`,
      "test.tsx",
    );
    assert.ok(!needsReactImport(sf));
  });

  it("returns false when React is a variable declaration", () => {
    const sf = createSourceFile(
      `const React = { createElement: () => {} };\nconst el = <div />;`,
      "test.tsx",
    );
    assert.ok(!needsReactImport(sf));
  });

  it("returns false when there is no JSX", () => {
    const sf = createSourceFile(`const x = 1;`, "test.ts");
    assert.ok(!needsReactImport(sf));
  });
});

describe("addReactImport", () => {
  it("prepends import React from 'react'", () => {
    const sf = createSourceFile(`const el = <div />;`, "test.tsx");
    const out = printSourceFile(addReactImport(sf));
    assert.ok(out.includes("react"), out);
  });

  it("reuses existing CDN react specifier from other import", () => {
    const sf = createSourceFile(
      `import { useState } from "https://esm.sh/react";\nconsole.log(useState);\nconst el = <div />;`,
      "test.tsx",
    );
    const out = printSourceFile(addReactImport(sf));
    assert.ok(out.includes("https://esm.sh/react"), out);
  });

  it("reuses react@version specifier", () => {
    const sf = createSourceFile(
      `import { useState } from "react@18";\nconsole.log(useState);\nconst el = <div />;`,
      "test.tsx",
    );
    const out = printSourceFile(addReactImport(sf));
    assert.ok(out.includes("react@18"), out);
  });

  it("does not reuse a '/react' subpath of another package", () => {
    // "@pierre/trees/react" is a subpath of @pierre/trees, not React itself.
    // Reusing it would make the injected `import React` resolve to a module
    // with no default export.
    const sf = createSourceFile(
      `import { FileTree } from "@pierre/trees/react";\nconst el = <div />;`,
      "test.tsx",
    );
    const out = printSourceFile(addReactImport(sf));
    assert.ok(
      out.includes('import React from "react"'),
      `should inject bare "react", got: ${out}`,
    );
    assert.ok(
      !out.includes('import React from "@pierre/trees/react"'),
      `must not reuse the subpath, got: ${out}`,
    );
  });

  it("still injects bare react when a real react import coexists with a subpath", () => {
    const sf = createSourceFile(
      `import { FileTree } from "@pierre/trees/react";\nimport { useState } from "react";\nconst el = <div />;`,
      "test.tsx",
    );
    const out = printSourceFile(addReactImport(sf));
    assert.ok(
      out.includes('import React from "react"'),
      `should reuse bare "react", got: ${out}`,
    );
    assert.ok(
      !out.includes('import React from "@pierre/trees/react"'),
      out,
    );
  });
});
