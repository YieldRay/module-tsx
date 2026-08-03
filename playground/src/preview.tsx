import { useEffect, useRef } from "react";
import type { VFS } from "./vfs.ts";

/** Shared reference handed to the (same-origin) preview iframe. */
export interface PreviewBridge {
  vfs: VFS;
  onEvent?: (type: string, payload: unknown) => void;
}

interface PreviewProps extends PreviewBridge {
  /** Incremented by the parent to trigger a fresh run of the preview. */
  runToken: number;
}

// Absolute URL of the runtime module that runs *inside* the iframe. Resolved
// against this module's URL so it works in both dev and build.
const RUNTIME_URL = new URL("./preview-runtime.ts", import.meta.url).href;

export function Preview({ vfs, runToken, onEvent }: PreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow as (Window & typeof globalThis) | null;
    if (!doc || !win) return;

    // Hand the bridge to the (same-origin) iframe before its module runs.
    win.__MODULE_TSX_PLAYGROUND__ = { vfs, onEvent };

    // The iframe imports the runtime module in ITS OWN realm, so the user's
    // code (and its `document` / `createRoot`) targets the iframe, not us.
    doc.open();
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8"></head><body></body>` +
        `<script type="module">` +
        `import(${JSON.stringify(RUNTIME_URL)}).then((m) => m.bootPreview());` +
        `<\/script></html>`,
    );
    doc.close();
  }, [vfs, runToken, onEvent]);

  return (
    <iframe
      ref={iframeRef}
      className="preview-iframe"
      title="preview"
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
