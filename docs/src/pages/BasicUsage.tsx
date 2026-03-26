import React from "react";
import CodeBlock from "../components/CodeBlock.tsx";

const INLINE_SCRIPT = `<script type="module" src="https://yieldray.github.io/module-tsx/dist/index.mjs"></script>

<!-- Inline TypeScript/JSX directly in your HTML -->
<script type="module-tsx">
  import React from "react";
  import { createRoot } from "react-dom/client";

  const root = document.getElementById("root") as HTMLDivElement;
  createRoot(root).render(<h1>Hello from inline TSX!</h1>);
</script>`;

const EXTERNAL_SCRIPT = `<script type="module" src="https://yieldray.github.io/module-tsx/dist/index.mjs"></script>

<!-- Reference an external .tsx file -->
<script type="module-tsx" src="./src/main.tsx"></script>`;

const ASYNC_SCRIPT = `<!-- async: starts executing immediately without waiting for previous scripts -->
<script type="module-tsx" src="./widget-a.tsx" async></script>
<script type="module-tsx" src="./widget-b.tsx" async></script>

<!-- without async: scripts execute in order, each waits for the previous -->
<script type="module-tsx" src="./step-1.tsx"></script>
<script type="module-tsx" src="./step-2.tsx"></script>`;

const MAIN_TSX = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";   // relative imports work!

createRoot(document.getElementById("root")!).render(<App />);`;

const APP_TSX = `export default function App() {
  return <h1>Hello from App.tsx!</h1>;
}`;

export default function BasicUsage() {
  return (
    <article>
      <h1 style={{ fontSize: "2.25rem", fontWeight: 700, marginTop: 0 }}>Basic Usage</h1>

      <h2>Inline Scripts</h2>
      <p>
        Write TypeScript and JSX directly inside a{" "}
        <code>{"<script type=\"module-tsx\">"}</code> tag:
      </p>
      <CodeBlock code={INLINE_SCRIPT} language="html" />

      <h2>External Files</h2>
      <p>
        Reference an external <code>.tsx</code> file using the <code>src</code> attribute.
        module-tsx will fetch, compile, and execute it:
      </p>
      <CodeBlock code={EXTERNAL_SCRIPT} language="html" />
      <p>The entry file can import other local files using relative paths:</p>
      <CodeBlock code={MAIN_TSX} language="tsx" filename="src/main.tsx" />
      <CodeBlock code={APP_TSX} language="tsx" filename="src/App.tsx" />

      <h2>The async Attribute</h2>
      <p>
        By default, multiple <code>{"<script type=\"module-tsx\">"}</code> tags execute
        sequentially — each one waits for the previous to finish. Add the <code>async</code>{" "}
        attribute to execute them concurrently:
      </p>
      <CodeBlock code={ASYNC_SCRIPT} language="html" />
    </article>
  );
}
