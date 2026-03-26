import React from "react";
import CodeBlock from "../components/CodeBlock.tsx";

const RELATIVE_IMPORT = `// main.tsx — loaded via <script type="module-tsx" src="./main.tsx">
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";         // fetched and compiled on the fly
import { formatDate } from "./utils/date.ts";  // .ts files work too

createRoot(document.getElementById("root")!).render(<App />);`;

const NPM_IMPORT = `// Bare specifiers are resolved to https://esm.sh/ automatically
import React from "react";
import { motion } from "framer-motion";
import dayjs from "dayjs";
import { Button } from "soda-material";`;

const CDN_IMPORT = `// Direct URL imports are passed through unchanged
import confetti from "https://cdn.skypack.dev/canvas-confetti";
import { html } from "https://esm.sh/htm/react";`;

const NODE_IMPORT = `// Node.js built-ins are polyfilled via JSPM
import { EventEmitter } from "node:events";
import path from "node:path";`;

const NPM_PREFIX = `// npm: prefix explicitly routes to esm.sh
import React from "npm:react";`;

export default function LoadingFiles() {
  return (
    <article>
      <h1 style={{ fontSize: "2.25rem", fontWeight: 700, marginTop: 0 }}>Loading Files</h1>
      <p
        style={{
          fontSize: "1.1rem",
          lineHeight: 1.7,
          color: "var(--md-sys-color-on-surface-variant)",
        }}
      >
        module-tsx handles all kinds of import specifiers automatically.
      </p>

      <h2>Relative Imports</h2>
      <p>
        Import local <code>.tsx</code>, <code>.ts</code>, and <code>.js</code> files using
        relative paths. Each file is fetched via HTTP, compiled, and cached as a Blob URL.
        Circular imports are handled safely.
      </p>
      <CodeBlock code={RELATIVE_IMPORT} language="tsx" />

      <h2>npm Packages</h2>
      <p>
        Bare specifiers (no path prefix) are automatically resolved to{" "}
        <code>https://esm.sh/</code>. Any npm package that ships an ES module build works:
      </p>
      <CodeBlock code={NPM_IMPORT} language="tsx" />

      <h2>Direct URL Imports</h2>
      <p>
        Absolute <code>https://</code> URLs are imported directly without transformation:
      </p>
      <CodeBlock code={CDN_IMPORT} language="tsx" />

      <h2>Node.js Built-ins</h2>
      <p>
        <code>node:</code> specifiers are polyfilled using{" "}
        <a href="https://jspm.io" target="_blank" rel="noopener">
          JSPM
        </a>{" "}
        browser polyfills:
      </p>
      <CodeBlock code={NODE_IMPORT} language="tsx" />

      <h2>npm: Prefix</h2>
      <p>
        The <code>npm:</code> prefix explicitly routes to esm.sh (same as bare specifiers):
      </p>
      <CodeBlock code={NPM_PREFIX} language="tsx" />

      <h2>Custom CDN</h2>
      <p>
        You can change the default CDN by configuring the <code>resolveBareSpecifier</code>{" "}
        option on the <code>ModuleTSX</code> instance. See the{" "}
        <a href="#api-reference">API Reference</a> for details.
      </p>
    </article>
  );
}
