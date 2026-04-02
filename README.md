# module-tsx

Run TypeScript (and React) modules directly in the browser, without a build step.

## Usage

```html
<!-- Load this library -->
<script type="module" src="https://esm.sh/module-tsx"></script>

<div id="root"></div>

<!-- Write your TypeScript/TSX inline -->
<script type="module-tsx">
  import React from "react"; // bare specifier → https://esm.sh/react
  import { createRoot } from "react-dom/client";
  import App from "./src/App.tsx"; // relative imports are fetched and compiled on the fly

  const root = document.getElementById("root") as HTMLDivElement;
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
</script>

<!-- OR load an external file -->
<script type="module-tsx" src="./main.tsx"></script>
```

You publish the **source code**, and users can run it directly in the browser **without any build step**.

```tsx
// src/App.tsx
export default function App() {
  return <div>Hello, module-tsx!</div>;
}
```

## Features

- **TypeScript & JSX/TSX** — transpiled on the fly using the TypeScript compiler
- **Bare specifier resolution** — `import "react"` is automatically rewritten to a CDN URL (defaults to `https://esm.sh/`)
- **Relative imports** — `.ts`/`.tsx` files are fetched and compiled recursively
- **CSS imports** — `import "./style.css"` injects a `<style>` tag; `import "./style.module.css"` returns a CSS Modules object
- **Import map support** — respects `<script type="importmap">` on the page for specifier overrides
- **Auto React import** — JSX is detected and `import React from "react"` is injected automatically if missing

## Programmatic API

```ts
import { ModuleTSX } from "module-tsx";

const m = new ModuleTSX({
  baseUrl: location.href, // base for resolving relative specifiers
  importMap: { imports: { react: "https://esm.sh/react" } }, // merged with page importmaps
  resolveBareSpecifier: "https://cdn.jsdelivr.net/npm/", // string prefix or function
});

// Import a module by specifier
const react = await m.import("react");
const app = await m.import("./app.tsx");

// Import from an in-memory string
const { x } = await m.importCode(document.location.href, `export const x: number = 1`);

// Events
m.addEventListener("import", (e) => console.log("loading", e.detail.id));
m.addEventListener("import:error", (e) => console.error("failed", e.detail.id, e.detail.error));
m.addEventListener("transform", (e) => console.log("compiling", e.detail.sourceUrl));
m.addEventListener("transform:error", (e) => console.error("compile error", e.detail.sourceUrl, e.detail.error));
```

## CDN

```html
<!-- ESM -->
<script type="module" src="https://esm.sh/module-tsx"></script>

<!-- ESM (self-contained, no external dependencies) -->
<script type="module" src="https://raw.esm.sh/module-tsx/dist/index.mjs"></script>

<!-- UMD (exposes window.ModuleTSX) -->
<script src="https://raw.esm.sh/module-tsx/dist/index.umd.js"></script>
```
