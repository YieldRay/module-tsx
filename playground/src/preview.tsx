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

// The standalone preview page (its own MPA entry). Document-relative so it
// resolves under any `base`.
const PREVIEW_URL = "preview.html";

interface PreviewIframeWindow extends Window {
  __MODULE_TSX_PLAYGROUND__?: PreviewBridge;
  bootPreview?: () => Promise<void>;
}

export function Preview({ vfs, runToken, onEvent }: PreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const drive = () => {
      const win = iframe.contentWindow as PreviewIframeWindow | null;
      if (!win) return;
      // Hand the bridge to the same-origin iframe, then boot in its own realm.
      win.__MODULE_TSX_PLAYGROUND__ = { vfs, onEvent };
      void win.bootPreview?.();
    };

    iframe.addEventListener("load", drive);
    // Reload for a fresh realm each run; runToken busts the cache.
    iframe.src = `${PREVIEW_URL}?run=${runToken}`;

    return () => iframe.removeEventListener("load", drive);
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
