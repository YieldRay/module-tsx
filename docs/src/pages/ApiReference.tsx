import React from "react";
import { Table } from "soda-material";
import CodeBlock from "../components/CodeBlock.tsx";

const CONSTRUCTOR_EXAMPLE = `import { ModuleTSX } from "https://yieldray.github.io/module-tsx/dist/index.mjs";

const instance = new ModuleTSX({
  baseUrl: "https://my-site.com/app/",
  resolveBareSpecifier: "https://esm.sh/",
});`;

const IMPORT_EXAMPLE = `// Import a module by URL or bare specifier
const mod = await instance.import("react");
const mod2 = await instance.import("./src/App.tsx");
const mod3 = await instance.import("https://esm.sh/dayjs");`;

const IMPORT_CODE_EXAMPLE = `// Compile and execute code from a string
const code = \`
  export function greet(name: string) {
    return \\\`Hello, \\\${name}!\\\`;
  }
\`;

const mod = await instance.importCode("https://my-site.com/", code);
mod.greet("World"); // "Hello, World!"`;

const EVENTS_EXAMPLE = `import { instance } from "https://yieldray.github.io/module-tsx/dist/index.mjs";

// Listen to all events
instance.addEventListener("*", (e) => {
  console.log(e.detail.type, e.detail.payload);
});

// Listen to specific events
instance.addEventListener("import", (e) => {
  console.log("Importing:", e.detail.id);
});

instance.addEventListener("import:error", (e) => {
  console.error("Import failed:", e.detail.id, e.detail.error);
});

instance.addEventListener("transform", (e) => {
  console.log("Transforming:", e.detail.sourceUrl);
});

instance.addEventListener("transform:error", (e) => {
  console.error("Transform failed:", e.detail.sourceUrl, e.detail.error);
});`;

const SINGLETON_EXAMPLE = `<!-- The singleton instance auto-processes <script type="module-tsx"> tags -->
<script type="module" src="https://yieldray.github.io/module-tsx/dist/index.mjs"></script>
<script type="module-tsx" src="./src/main.tsx"></script>

<!-- Access the singleton from another module script -->
<script type="module">
  import { instance } from "https://yieldray.github.io/module-tsx/dist/index.mjs";
  instance.addEventListener("transform", (e) => {
    console.log("Transformed:", e.detail.sourceUrl);
  });
</script>`;

const CUSTOM_CDN_EXAMPLE = `import { ModuleTSX } from "https://yieldray.github.io/module-tsx/dist/index.mjs";

// Use a string prefix (appended to bare specifier)
const instance = new ModuleTSX({
  resolveBareSpecifier: "https://cdn.jsdelivr.net/npm/",
});

// Or a function for full control
const instance2 = new ModuleTSX({
  resolveBareSpecifier: (specifier) => {
    if (specifier.startsWith("@myorg/")) {
      return \`https://my-private-cdn.com/\${specifier}\`;
    }
    return \`https://esm.sh/\${specifier}\`;
  },
});`;

const configRows = [
  {
    prop: "baseUrl",
    type: "string",
    default: "location.href",
    desc: "Base URL for resolving relative specifiers",
  },
  {
    prop: "fetch",
    type: "(url: string) => Promise<Response>",
    default: "fetch",
    desc: "Custom fetch implementation (e.g. with auth headers or caching)",
  },
  {
    prop: "importMap",
    type: "ImportMapData",
    default: "parsed from DOM",
    desc: 'Import map for specifier aliasing. Defaults to reading <script type="importmap"> from the page',
  },
  {
    prop: "resolveBareSpecifier",
    type: 'string | ((s: string) => string)',
    default: '"https://esm.sh/"',
    desc: 'CDN base URL or resolver function for bare specifiers like "react"',
  },
];

const eventRows = [
  { name: "import", detail: "{ id: string }", desc: "Fired when starting to import a module" },
  { name: "import:error", detail: "{ id: string; error: any }", desc: "Fired when an import fails" },
  { name: "transform", detail: "{ sourceUrl: string }", desc: "Fired when starting to transform source code" },
  { name: "transform:error", detail: "{ sourceUrl: string; error: any }", desc: "Fired when transformation fails" },
  { name: "*", detail: "{ type: string; payload: any }", desc: "Wildcard — fires for every event with its type and payload" },
];

export default function ApiReference() {
  return (
    <article>
      <h1 style={{ fontSize: "2.25rem", fontWeight: 700, marginTop: 0 }}>API Reference</h1>

      <h2>
        <code>new ModuleTSX(config?)</code>
      </h2>
      <p>
        Creates a new ModuleTSX instance. The singleton <code>instance</code> (used by{" "}
        <code>{"<script type=\"module-tsx\">"}</code> auto-processing) is exported from the ESM
        build.
      </p>
      <CodeBlock code={CONSTRUCTOR_EXAMPLE} language="tsx" />

      <h3>Config Options</h3>
      <div className="sd-scrollbar" style={{ overflowX: "auto", margin: "1rem 0" }}>
        <Table style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Option</th>
              <th>Type</th>
              <th>Default</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {configRows.map((row) => (
              <tr key={row.prop}>
                <td><code>{row.prop}</code></td>
                <td><code>{row.type}</code></td>
                <td><code>{row.default}</code></td>
                <td>{row.desc}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <h2>
        <code>instance.import(id)</code>
      </h2>
      <p>
        Imports a module by specifier. Handles bare specifiers, relative paths, and absolute URLs.
        Returns a promise resolving to the module's exports.
      </p>
      <CodeBlock code={IMPORT_EXAMPLE} language="tsx" />

      <h2>
        <code>instance.importCode(sourceUrl, code)</code>
      </h2>
      <p>
        Compiles and executes TypeScript/TSX source code provided as a string.{" "}
        <code>sourceUrl</code> is used as the base for resolving relative imports within the code.
      </p>
      <CodeBlock code={IMPORT_CODE_EXAMPLE} language="tsx" />

      <h2>Events</h2>
      <p>
        <code>ModuleTSX</code> extends <code>EventTarget</code>. You can listen to lifecycle
        events for monitoring and error handling:
      </p>
      <CodeBlock code={EVENTS_EXAMPLE} language="tsx" />

      <div className="sd-scrollbar" style={{ overflowX: "auto", margin: "1rem 0" }}>
        <Table style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Event</th>
              <th>detail shape</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {eventRows.map((row) => (
              <tr key={row.name}>
                <td><code>{row.name}</code></td>
                <td><code>{row.detail}</code></td>
                <td>{row.desc}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <h2>Singleton & ESM</h2>
      <p>
        The ESM build exports <code>instance</code> (the singleton used for auto-processing) and
        the <code>ModuleTSX</code> class. Load it with <code>{'<script type="module">'}</code> —
        it registers the <code>DOMContentLoaded</code> listener automatically.
      </p>
      <CodeBlock code={SINGLETON_EXAMPLE} language="html" />

      <h2>Custom CDN</h2>
      <CodeBlock code={CUSTOM_CDN_EXAMPLE} language="tsx" />
    </article>
  );
}
