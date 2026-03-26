import React, { useEffect, useRef, useState } from "react";
import { highlightElement } from "@speed-highlight/core/dist/index.js";
import { IconButton } from "soda-material";
import { mdiContentCopy, mdiCheck } from "@mdi/js";

const LANG_MAP: Record<string, string> = {
  tsx: "ts",
  jsx: "js",
  typescript: "ts",
  ts: "ts",
  html: "html",
  css: "css",
  bash: "bash",
  json: "json",
  js: "js",
  javascript: "js",
};

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
}

export default function CodeBlock({ code, language = "tsx", filename }: CodeBlockProps) {
  const codeRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const el = codeRef.current;
    if (!el) return;
    el.textContent = code;
    highlightElement(el, LANG_MAP[language] ?? language, "multiline", { hideLineNumbers: true });
  }, [code, language]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 8,
        margin: "1rem 0",
        border: "1px solid var(--md-sys-color-outline-variant)",
        fontSize: 13,
      }}
    >
      {filename && (
        <div
          style={{
            padding: "5px 12px",
            fontSize: 12,
            fontFamily: "monospace",
            background: "var(--md-sys-color-surface-container)",
            borderBottom: "1px solid var(--md-sys-color-outline-variant)",
            color: "var(--md-sys-color-on-surface-variant)",
            borderRadius: "8px 8px 0 0",
          }}
        >
          {filename}
        </div>
      )}
      <div style={{ position: "absolute", top: filename ? 28 : 4, right: 4, zIndex: 1 }}>
        <IconButton path={copied ? mdiCheck : mdiContentCopy} size={0.8} onClick={handleCopy} />
      </div>
      <code ref={codeRef} style={{ display: "block", overflowX: "auto", scrollbarWidth: "thin" }} />
    </div>
  );
}
