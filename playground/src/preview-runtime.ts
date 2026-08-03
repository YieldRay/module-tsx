// This module runs INSIDE the preview iframe's own realm.
//
// It must import module-tsx here (not receive it from the parent) so that the
// dynamic `import()` of compiled blob modules — and therefore every `document`,
// `window`, and `createRoot` reference inside the user's code — resolves against
// the iframe, not the parent page.
import { ModuleTSX } from "module-tsx/esm";
import { VFS_ORIGIN } from "./vfs.ts";
import type { PreviewBridge } from "./preview.tsx";

declare global {
  interface Window {
    __MODULE_TSX_PLAYGROUND__?: PreviewBridge;
  }
}

function contentType(path: string): string {
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".html")) return "text/html";
  if (path.endsWith(".wasm")) return "application/wasm";
  return "application/javascript";
}

/** Render an error message into the iframe body. */
function showError(message: string): void {
  const pre = document.createElement("pre");
  pre.style.cssText =
    "color:#c0392b;padding:1rem;font-family:monospace;white-space:pre-wrap";
  pre.textContent = message;
  document.body.appendChild(pre);
}

export async function bootPreview(): Promise<void> {
  // The parent placed the bridge on this iframe's window (same-origin).
  const bridge = window.__MODULE_TSX_PLAYGROUND__;
  if (!bridge) return;
  const { vfs, onEvent } = bridge;

  const vfsFetch = async (fullUrl: string): Promise<Response> => {
    const path = vfs.resolve(fullUrl);
    if (path === undefined) return fetch(fullUrl);
    return new Response(vfs.read(path) ?? "", {
      status: 200,
      headers: { "content-type": contentType(path) },
    });
  };

  const instance = new ModuleTSX({ baseUrl: VFS_ORIGIN, fetch: vfsFetch });
  if (onEvent) {
    instance.addEventListener("*", (event) => {
      const { type, payload } = (event as CustomEvent).detail;
      try {
        onEvent(type, payload);
      } catch {
        /* ignore listener errors */
      }
    });
  }

  const indexHtml = vfs.read("index.html");
  if (indexHtml === undefined) {
    showError("No index.html in the virtual file system.");
    return;
  }

  const parsed = new DOMParser().parseFromString(indexHtml, "text/html");

  // Carry over an import map, if any.
  const importMapScript = parsed.querySelector('script[type="importmap"]');
  if (importMapScript) {
    const el = document.createElement("script");
    el.type = "importmap";
    el.textContent = importMapScript.textContent || "";
    document.head.appendChild(el);
  }

  // Inline local stylesheets from the VFS; keep external ones as links.
  for (const link of parsed.querySelectorAll<HTMLLinkElement>(
    'link[rel="stylesheet"]',
  )) {
    const href = link.getAttribute("href");
    if (!href) continue;
    const path = vfs.resolve(new URL(href, VFS_ORIGIN).href);
    if (path === undefined) {
      document.head.appendChild(link.cloneNode(true));
      continue;
    }
    const style = document.createElement("style");
    style.dataset.href = href;
    style.textContent = vfs.read(path) ?? "";
    document.head.appendChild(style);
  }

  // Copy body markup, except module-tsx scripts which we drive manually below.
  for (const node of parsed.body.childNodes) {
    const isScript =
      node.nodeType === Node.ELEMENT_NODE &&
      (node as Element).tagName === "SCRIPT";
    if (!isScript) document.body.appendChild(document.importNode(node, true));
  }

  for (const script of parsed.querySelectorAll<HTMLScriptElement>(
    'script[type="module-tsx"]',
  )) {
    const src = script.getAttribute("src");
    try {
      if (src) {
        await instance.import(new URL(src, VFS_ORIGIN).href);
      } else {
        await instance.importCode(VFS_ORIGIN, script.textContent || "");
      }
    } catch (error) {
      showError(
        String((error as Error)?.stack || (error as Error)?.message || error),
      );
    }
  }
}
