import React from "react";
import CodeBlock from "../components/CodeBlock.tsx";

const QUICK_START = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
  </head>
  <body>
    <div id="root"></div>

    <!-- 1. Load module-tsx from CDN -->
    <script type="module" src="https://yieldray.github.io/module-tsx/dist/index.mjs"></script>

    <!-- 2. Write TypeScript/React directly -->
    <script type="module-tsx">
      import React from "react";
      import { createRoot } from "react-dom/client";

      function App() {
        return <h1>Hello, module-tsx!</h1>;
      }

      createRoot(document.getElementById("root")!).render(<App />);
    </script>
  </body>
</html>`;

const SERVE_CMD = `# Any static server works
npx serve .
# or
python3 -m http.server 8080`;

export default function GettingStarted() {
  return (
    <article>
      <h1 className="text-4xl font-bold mt-0">Getting Started</h1>
      <p className="text-lg leading-relaxed text-[var(--md-sys-color-on-surface-variant)]">
        <strong>module-tsx</strong> lets you run TypeScript and React directly in the browser —
        no build step, no npm install, no bundler required. You publish source code and users run
        it instantly.
      </p>

      <h2>Quick Start</h2>
      <p>Add two script tags to any HTML file:</p>
      <CodeBlock code={QUICK_START} language="html" filename="index.html" />

      <h2>Serve Locally</h2>
      <p>
        Because module-tsx fetches your source files via HTTP, you need to serve your project
        from a local server (not <code>file://</code>):
      </p>
      <CodeBlock code={SERVE_CMD} language="bash" />

      <h2>How It Works</h2>
      <p>
        When the page loads, module-tsx finds every{" "}
        <code>{"<script type=\"module-tsx\">"}</code> tag, fetches and transforms the
        TypeScript/JSX source using the TypeScript compiler running in the browser, then executes
        the result as an ES module via a Blob URL.
      </p>
      <p>
        Bare specifiers like <code>import React from "react"</code> are automatically resolved
        to <code>https://esm.sh/react</code>. You can use any npm package without installing
        anything.
      </p>
    </article>
  );
}
