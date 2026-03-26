import React from "react";
import CodeBlock from "../components/CodeBlock.tsx";

const CSS_IMPORT = `// Regular CSS — injected as a <style> tag in <head>
import "./styles.css";
import "soda-material/dist/style.css";  // package CSS subpaths work too`;

const CSS_FILE = `/* styles.css */
body {
  font-family: system-ui, sans-serif;
}

.card {
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}`;

const CSS_MODULE_IMPORT = `// CSS Modules — class names are scoped with a hash
import styles from "./Button.module.css";

function Button({ children }: { children: React.ReactNode }) {
  // styles.btn === "btn_a3f2c" (hashed at runtime)
  return <button className={styles.btn}>{children}</button>;
}`;

const CSS_MODULE_FILE = `/* Button.module.css */
.btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  background: #6750a4;
  color: white;
  border: none;
  cursor: pointer;
}

.btn:hover {
  opacity: 0.9;
}`;

export default function CssModules() {
  return (
    <article>
      <h1 style={{ fontSize: "2.25rem", fontWeight: 700, marginTop: 0 }}>CSS & CSS Modules</h1>
      <p
        style={{
          fontSize: "1.1rem",
          lineHeight: 1.7,
          color: "var(--md-sys-color-on-surface-variant)",
        }}
      >
        module-tsx handles both regular CSS imports and CSS Modules out of the box.
      </p>

      <h2>Regular CSS</h2>
      <p>
        Importing a <code>.css</code> file injects its contents as a <code>{"<style>"}</code>{" "}
        tag in <code>{"<head>"}</code>. CSS from npm package subpaths ending in{" "}
        <code>.css</code> is also handled automatically:
      </p>
      <CodeBlock code={CSS_IMPORT} language="tsx" />
      <CodeBlock code={CSS_FILE} language="css" filename="styles.css" />

      <h2>CSS Modules</h2>
      <p>
        Files ending in <code>.module.css</code> are treated as CSS Modules. Class names are
        scoped by appending a short hash, preventing style collisions between components:
      </p>
      <CodeBlock code={CSS_MODULE_IMPORT} language="tsx" />
      <CodeBlock code={CSS_MODULE_FILE} language="css" filename="Button.module.css" />

      <p>
        The default export is an object mapping your original class names to the hashed
        versions. Only classes you actually use are included.
      </p>
    </article>
  );
}
