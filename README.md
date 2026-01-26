# module-tsx

Run TypeScript (and React) module directly in the browser.

# Usage

```html
<!-- Load This Library -->
<script type="module" src="https://esm.sh/module-tsx"></script>

<div id="root"></div>

<!-- Write Your TypeScript Module -->
<script type="module-tsx">
  import React from "react"; // <- This will be converted to https://esm.sh/react
  import { createRoot } from "react-dom/client"; // <- This will also be converted automatically
  import App from "./src/App.tsx"; // <- Your TypeScript module will also be compiled on the fly
  import lib from "https://my.cdn.domain"; // <- Direct http import will NOT be compiled

  const root = document.getElementById("root") as HTMLDivElement; // <- You can write TypeScript directly
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
    // ^ You can also write JSX/TSX directly
  );
</script>
<!-- OR -->
<script type="module-tsx" src="./main.tsx"></script>
```

You publish the **source code**, and users can run it directly in the browser **without any build step**.

```tsx
// src/App.tsx
export default function App() {
  return <div>Hello, module-tsx!</div>;
}
```
