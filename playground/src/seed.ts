/**
 * Seed content for a fresh virtual file system.
 *
 * The playground renders the VFS `index.html` inside a sandboxed iframe. All
 * assets referenced by `index.html` (the `module-tsx` scripts, the `.tsx`
 * files they import, CSS, etc.) are loaded through module-tsx with a custom
 * `fetch` that reads from this VFS.
 */
export const SEED_FILES: Record<string, string> = {
  "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>module-tsx app</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <div id="root"></div>

    <!-- This TypeScript/TSX file is fetched from the VFS and compiled on the fly -->
    <script type="module-tsx" src="./main.tsx"></script>
  </body>
</html>
`,

  "main.tsx": `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";

const root = document.getElementById("root")!;
createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`,

  "App.tsx": `import { useState } from "react";

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <main className="app">
      <h1>Hello, module-tsx!</h1>
      <p>Edit these files on the left and press Run to see changes.</p>
      <button onClick={() => setCount((c) => c + 1)}>count is {count}</button>
    </main>
  );
}
`,

  "style.css": `:root {
  color-scheme: light dark;
  font-family: system-ui, -apple-system, sans-serif;
}

body {
  margin: 0;
}

.app {
  padding: 2rem;
  max-width: 40rem;
  margin: 0 auto;
}

.app h1 {
  font-size: 1.6rem;
}

.app button {
  font-size: 1rem;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid currentColor;
  background: transparent;
  cursor: pointer;
}
`,
};

/** Return a fresh copy of the seed file map. */
export function createSeedFiles(): Record<string, string> {
  return { ...SEED_FILES };
}
