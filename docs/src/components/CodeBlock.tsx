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
    <div className="relative rounded-lg my-4 border border-[var(--md-sys-color-outline-variant)] text-sm">
      {filename && (
        <div className="px-3 py-1 text-xs font-mono bg-[var(--md-sys-color-surface-container)] border-b border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)] rounded-t-lg">
          {filename}
        </div>
      )}
      <div className={`absolute ${filename ? "top-7" : "top-1"} right-1 z-10`}>
        <IconButton path={copied ? mdiCheck : mdiContentCopy} size={0.8} onClick={handleCopy} />
      </div>
      <code ref={codeRef} className="block overflow-x-auto" style={{ scrollbarWidth: "thin" }} />
    </div>
  );
}
