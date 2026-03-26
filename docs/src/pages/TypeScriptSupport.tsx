import React from "react";
import CodeBlock from "../components/CodeBlock.tsx";

const TS_EXAMPLE = `import React, { useState } from "react";

interface User {
  id: number;
  name: string;
  role: "admin" | "user";
}

function UserCard({ user }: { user: User }) {
  return (
    <div>
      <h3>{user.name}</h3>
      <span style={{ color: user.role === "admin" ? "red" : "inherit" }}>
        {user.role}
      </span>
    </div>
  );
}

function App() {
  const [users] = useState<User[]>([
    { id: 1, name: "Alice", role: "admin" },
    { id: 2, name: "Bob",   role: "user"  },
  ]);
  return (
    <ul>
      {users.map(u => <li key={u.id}><UserCard user={u} /></li>)}
    </ul>
  );
}`;

const GENERICS_EXAMPLE = `function identity<T>(value: T): T {
  return value;
}

// Type assertions work too
const el = document.getElementById("root") as HTMLDivElement;`;

const ENUM_EXAMPLE = `// const enums are supported
const enum Direction {
  Up = "UP",
  Down = "DOWN",
}

const dir: Direction = Direction.Up;`;

export default function TypeScriptSupport() {
  return (
    <article>
      <h1 style={{ fontSize: "2.25rem", fontWeight: 700, marginTop: 0 }}>TypeScript Support</h1>
      <p
        style={{
          fontSize: "1.1rem",
          lineHeight: 1.7,
          color: "var(--md-sys-color-on-surface-variant)",
        }}
      >
        module-tsx uses the TypeScript compiler to transpile your code in the browser. All
        TypeScript syntax is supported.
      </p>

      <h2>Type Annotations & Interfaces</h2>
      <p>
        Full TypeScript syntax including interfaces, type aliases, generics, and union types:
      </p>
      <CodeBlock code={TS_EXAMPLE} language="tsx" />

      <h2>Generics & Type Assertions</h2>
      <CodeBlock code={GENERICS_EXAMPLE} language="tsx" />

      <h2>Enums</h2>
      <CodeBlock code={ENUM_EXAMPLE} language="tsx" />

      <h2>Runtime Behavior</h2>
      <p>
        Type errors are <strong>silently ignored</strong> at runtime — module-tsx transpiles
        with <code>noCheck: true</code>, matching the behavior of Babel and esbuild. Your code
        runs even if it has type errors. Use your editor (VS Code, etc.) for type checking during
        development.
      </p>
      <p>
        JSX is automatically detected. If your code uses JSX without importing React,
        module-tsx will inject <code>import React from "react"</code> automatically.
      </p>
    </article>
  );
}
