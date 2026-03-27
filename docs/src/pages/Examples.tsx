import React, { useState } from "react";
import { Button, TextField, Switch, Tabs, LinearProgressIndicator } from "soda-material";
import Demo from "../components/Demo.tsx";
import CodeBlock from "../components/CodeBlock.tsx";

const COUNTER_CODE = `import React, { useState } from "react";
import { Button } from "soda-material";
import "soda-material/dist/style.css";

export default function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
      <Button variant="outlined" onClick={() => setCount(c => c - 1)}>-</Button>
      <span style={{ fontSize: "1.5rem", minWidth: 40, textAlign: "center" }}>{count}</span>
      <Button onClick={() => setCount(c => c + 1)}>+</Button>
    </div>
  );
}`;

const FORM_CODE = `import React, { useState } from "react";
import { TextField, Button } from "soda-material";
import "soda-material/dist/style.css";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (submitted) return <p>Welcome, {email}!</p>;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
      style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 320 }}
    >
      <TextField
        labelText="Email"
        variant="outlined"
        value={email}
        onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
      />
      <Button type="submit">Sign In</Button>
    </form>
  );
}`;

const TABS_CODE = `import React, { useState } from "react";
import { Tabs } from "soda-material";
import "soda-material/dist/style.css";

const TABS = [
  { value: "overview", label: "Overview", content: "This is the overview tab." },
  { value: "details",  label: "Details",  content: "These are the details."    },
  { value: "history",  label: "History",  content: "This is the history."      },
];

export default function TabsDemo() {
  const [active, setActive] = useState("overview");
  const tab = TABS.find(t => t.value === active)!;
  return (
    <div>
      <Tabs
        value={active}
        onChange={setActive}
        items={TABS}
        variant="secondary"
      />
      <p style={{ padding: "1rem 0" }}>{tab.content}</p>
    </div>
  );
}`;

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div className="flex items-center gap-4">
      <Button variant="outlined" onClick={() => setCount((c) => c - 1)}>
        -
      </Button>
      <span className="text-2xl min-w-10 text-center">{count}</span>
      <Button onClick={() => setCount((c) => c + 1)}>+</Button>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (submitted)
    return (
      <p>
        Welcome, <strong>{email}</strong>!
      </p>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
      }}
      className="flex flex-col gap-4 max-w-xs"
    >
      <TextField
        labelText="Email"
        variant="outlined"
        value={email}
        onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
      />
      <Button type="submit">Sign In</Button>
    </form>
  );
}

function TabsDemo() {
  const tabs = [
    { value: "overview", label: "Overview" },
    { value: "details", label: "Details" },
    { value: "history", label: "History" },
  ];
  const content: Record<string, string> = {
    overview: "This is the overview tab.",
    details: "These are the details.",
    history: "This is the history.",
  };
  const [active, setActive] = useState("overview");
  return (
    <div>
      <Tabs value={active} onChange={setActive} items={tabs} variant="secondary" />
      <p className="py-4">{content[active]}</p>
    </div>
  );
}

function ProgressDemo() {
  const [value, setValue] = useState(0.4);
  const [indeterminate, setIndeterminate] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <LinearProgressIndicator value={indeterminate ? undefined : value} />
      <div className="flex items-center gap-4">
        <Switch
          checked={indeterminate}
          onClick={() => setIndeterminate((v) => !v)}
        />
        <span className="text-sm">Indeterminate</span>
      </div>
      {!indeterminate && (
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={value}
          onInput={(e) => setValue(parseFloat((e.target as HTMLInputElement).value))}
          className="w-full"
        />
      )}
    </div>
  );
}

export default function Examples() {
  return (
    <article>
      <h1 className="text-4xl font-bold mt-0">Examples</h1>
      <p className="text-lg leading-relaxed text-[var(--md-sys-color-on-surface-variant)]">
        Live interactive demos — these components are running via module-tsx right now.
      </p>

      <h2>Counter</h2>
      <Demo title="Live Demo">
        <Counter />
      </Demo>
      <CodeBlock code={COUNTER_CODE} language="tsx" />

      <h2>Form</h2>
      <Demo title="Live Demo">
        <LoginForm />
      </Demo>
      <CodeBlock code={FORM_CODE} language="tsx" />

      <h2>Tabs</h2>
      <Demo title="Live Demo">
        <TabsDemo />
      </Demo>
      <CodeBlock code={TABS_CODE} language="tsx" />

      <h2>Progress Indicator</h2>
      <Demo title="Live Demo">
        <ProgressDemo />
      </Demo>
    </article>
  );
}
