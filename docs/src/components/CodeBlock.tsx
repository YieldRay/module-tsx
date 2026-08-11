import { useState, type ComponentProps } from "react";
import { Code } from "@sugar-high/react";
import { IconButton } from "soda-material";
import { mdiContentCopy, mdiCheck } from "@mdi/js";

interface CodeBlockProps {
  code: string;
  lang: ComponentProps<typeof Code>["lang"];
  filename?: string;
}

export default function CodeBlock({ code, lang, filename }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="relative rounded-lg my-4 border border-[var(--md-sys-color-outline-variant)] text-sm overflow-hidden">
      {filename && (
        <div className="px-3 py-1 text-xs font-mono bg-[var(--md-sys-color-surface-container)] border-b border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)] rounded-t-lg">
          {filename}
        </div>
      )}
      <div className={`absolute ${filename ? "top-7" : "top-1"} right-1 z-10`}>
        <IconButton path={copied ? mdiCheck : mdiContentCopy} size={0.8} onClick={handleCopy} />
      </div>
      <Code lang={lang}>{code}</Code>
    </div>
  );
}
