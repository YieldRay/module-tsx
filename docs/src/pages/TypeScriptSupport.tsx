import React from "react";
import CodeBlock from "../components/CodeBlock.tsx";

const BASIC_EXAMPLE = `<script type="module-tsx">
  import React from "react";
  import { createRoot } from "react-dom/client";

  interface User {
    id: number;
    name: string;
  }

  function App() {
    const users: User[] = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];
    return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
  }

  createRoot(document.getElementById("root")!).render(<App />);
</script>`;

const IMPORT_EXAMPLE = `<!-- Entry file can import local .ts / .tsx files -->
<script type="module-tsx" src="./src/main.tsx"></script>`;

export default function TypeScriptSupport() {
  return (
    <article>
      <h1>TypeScript Support</h1>
      <p>
        module-tsx uses the TypeScript compiler (running in the browser) to transpile your code
        before execution. You can write full TypeScript syntax — interfaces, generics, enums,
        type assertions — directly inside <code>{`<script type="module-tsx">`}</code> tags or
        in <code>.ts</code> / <code>.tsx</code> files.
      </p>

      <h2>How It Works</h2>
      <p>
        Transpilation runs with <code>noCheck: true</code>, so type errors are silently ignored
        at runtime — matching the behavior of Babel and esbuild. Your code runs even if it has
        type errors. Use your editor for type checking during development.
      </p>
      <p>
        JSX is automatically detected. If your code uses JSX without importing React,
        module-tsx injects <code>import React from "react"</code> automatically.
      </p>
      <CodeBlock code={BASIC_EXAMPLE} language="html" filename="index.html" />

      <h2>External .ts / .tsx Files</h2>
      <p>
        The <code>src</code> attribute accepts <code>.ts</code> and <code>.tsx</code> files.
        Relative imports inside those files are also fetched, compiled, and cached as Blob URLs.
      </p>
      <CodeBlock code={IMPORT_EXAMPLE} language="html" />
    </article>
  );
}
