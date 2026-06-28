import type { ModuleTSX } from "./module-tsx.ts";
import typescript from "typescript";
import type ts from "typescript";
import { createSourceFile } from "./ts.ts";
import { mapToOriginalPosition } from "./source-map.ts";

// Vite-inspired error overlay styles
const overlayStyle = /*css*/ `
:host {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 99999;
  --monospace: 'SFMono-Regular', Consolas,
  'Liberation Mono', Menlo, Courier, monospace;
  --red: #ff5555;
  --yellow: #e2aa53;
  --purple: #cfa4ff;
  --cyan: #2dd9da;
  --dim: #c9c9c9;

  --window-background: #181818;
  --window-color: #d8d8d8;
}

.backdrop {
  position: fixed;
  z-index: 99999;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow-y: scroll;
  margin: 0;
  background: rgba(0, 0, 0, 0.66);
  scrollbar-width: thin;
  scrollbar-color: #444 #1a1a1a;
}

.backdrop::-webkit-scrollbar {
  width: 8px;
}

.backdrop::-webkit-scrollbar-track {
  background: #1a1a1a;
}

.backdrop::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 4px;
}

.backdrop::-webkit-scrollbar-thumb:hover {
  background: #666;
}

.window {
  font-family: var(--monospace);
  line-height: 1.5;
  max-width: 80vw;
  color: var(--window-color);
  box-sizing: border-box;
  margin: 30px auto;
  padding: 2.5vh 4vw;
  position: relative;
  background: var(--window-background);
  border-radius: 6px 6px 8px 8px;
  box-shadow: 0 19px 38px rgba(0,0,0,0.30), 0 15px 12px rgba(0,0,0,0.22);
  overflow: hidden;
  border-top: 8px solid var(--red);
  direction: ltr;
  text-align: left;
}

pre {
  font-family: var(--monospace);
  font-size: 16px;
  margin-top: 0;
  margin-bottom: 1em;
  overflow-x: scroll;
  scrollbar-width: thin;
  scrollbar-color: #444 transparent;
}

pre::-webkit-scrollbar {
  height: 6px;
}

pre::-webkit-scrollbar-track {
  background: transparent;
}

pre::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 3px;
}

pre::-webkit-scrollbar-thumb:hover {
  background: #666;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1em;
  margin-bottom: 1em;
}

.message {
  line-height: 1.3;
  font-weight: 600;
  white-space: pre-wrap;
  margin: 0;
  padding: 0;
  flex: 1;
  min-width: 0;
  overflow-x: hidden;
}

.message-body {
  color: var(--red);
}

.plugin {
  color: var(--purple);
}

.file {
  color: var(--cyan);
  margin-bottom: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.frame {
  color: var(--yellow);
  padding: 0.75em 1em;
  background: #1a1a1a;
  border-radius: 4px;
}

.frame-line {
  color: var(--dim);
}

.frame-line-number {
  display: inline-block;
  width: 3em;
  text-align: right;
  margin-right: 1em;
  color: #666;
  user-select: none;
}

.frame-line-error {
  color: var(--yellow);
  font-weight: bold;
}

.frame-line-error .frame-line-number {
  color: var(--red);
}

.frame-underline {
  color: var(--red);
  font-weight: bold;
}

.stack {
  font-size: 13px;
  color: var(--dim);
}

.tip {
  font-size: 13px;
  color: #999;
  border-top: 1px dotted #999;
  padding-top: 13px;
  line-height: 1.8;
}

code {
  font-size: 13px;
  font-family: var(--monospace);
  color: var(--yellow);
}

.copy-btn {
  flex-shrink: 0;
  padding: 6px 12px;
  font-family: var(--monospace);
  font-size: 12px;
  font-weight: 600;
  color: var(--dim);
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}

.copy-btn:hover {
  background: #333;
  color: #fff;
  border-color: #666;
}

.copy-btn:active {
  background: #444;
}

.copy-btn.copied {
  color: #50fa7b;
  border-color: #50fa7b;
}

kbd {
  line-height: 1.5;
  font-family: ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.75rem;
  font-weight: 700;
  background-color: rgb(38, 40, 44);
  color: rgb(166, 167, 171);
  padding: 0.15rem 0.3rem;
  border-radius: 0.25rem;
  border-width: 0.0625rem 0.0625rem 0.1875rem;
  border-style: solid;
  border-color: rgb(54, 57, 64);
  border-image: initial;
}
`;

export function setupErrorOverlay(instance: ModuleTSX): void {
  /** If the error originates from a module-tsx blob URL, show the overlay and return true. */
  const handleRuntimeError = (error: Error): boolean => {
    const blobLocation = extractBlobLocation(error.stack || "", instance);
    if (!blobLocation) return false;

    const sourceUrl = instance.getSourceUrlByBlob(blobLocation.blobUrl);
    if (!sourceUrl) return false;

    showErrorOverlay(sourceUrl, error, instance);
    return true;
  };

  instance.addEventListener("*", (event) => {
    const { type, payload } = (event as CustomEvent).detail;
    if (!type.endsWith(":error")) return;

    showErrorOverlay(payload.id || payload.sourceUrl, payload.error, instance);
  });

  // Catch runtime errors (e.g. from event handlers, timeouts) originating from module-tsx modules
  window.addEventListener("error", (event) => {
    if (event.error instanceof Error && handleRuntimeError(event.error)) {
      event.preventDefault();
    }
  });

  // Catch unhandled promise rejections from module-tsx modules
  window.addEventListener("unhandledrejection", (event) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));

    if (handleRuntimeError(error)) {
      event.preventDefault();
    }
  });
}

const overlayId = "module-tsx-error-overlay";

/** Replace blob: URLs in text with their original source URLs, using source maps for line mapping */
export async function replaceBlobUrls(text: string, instance: ModuleTSX): Promise<string> {
  // Match blob URLs (blob:http://host/uuid) optionally followed by :line:col
  const blobPattern = /blob:https?:\/\/[^\s"')]+/g;
  const matches = [...text.matchAll(blobPattern)];
  if (matches.length === 0) return text;

  let result = text;
  // Process matches in reverse to preserve offsets
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const fullMatch = match[0];
    const startIdx = match.index!;

    // Try to resolve progressively stripping trailing :number segments
    let blobUrl = fullMatch;
    let line: number | undefined;
    let col: number | undefined;

    // Strip :col if present
    const colMatch = blobUrl.match(/^(.*):(\d+)$/);
    if (colMatch) {
      const candidate = colMatch[1];
      const num = Number(colMatch[2]);
      if (instance.getSourceUrlByBlob(candidate)) {
        blobUrl = candidate;
        col = num;
      } else {
        // Try stripping another :line segment
        const lineMatch = candidate.match(/^(.*):(\d+)$/);
        if (lineMatch && instance.getSourceUrlByBlob(lineMatch[1])) {
          blobUrl = lineMatch[1];
          line = Number(lineMatch[2]);
          col = num;
        }
      }
    }

    const sourceUrl = instance.getSourceUrlByBlob(blobUrl);
    if (!sourceUrl) continue;

    let replacement: string;
    if (line != null) {
      // Use source map to get accurate original position
      const originalSource = instance.getOriginalSource(blobUrl);
      if (originalSource) {
        const origPos = await mapToOriginalPosition(originalSource, line, col);
        if (origPos) {
          replacement = col != null
            ? `${sourceUrl}:${origPos.line}:${origPos.col}`
            : `${sourceUrl}:${origPos.line}`;
        } else {
          // Fallback: adjust for prepended import.meta.url line
          const adjustedLine = Math.max(1, line - 1);
          replacement = col != null
            ? `${sourceUrl}:${adjustedLine}:${col}`
            : `${sourceUrl}:${adjustedLine}`;
        }
      } else {
        const adjustedLine = Math.max(1, line - 1);
        replacement = col != null
          ? `${sourceUrl}:${adjustedLine}:${col}`
          : `${sourceUrl}:${adjustedLine}`;
      }
    } else if (col != null) {
      // Only one trailing number - treat it as a line number
      const originalSource = instance.getOriginalSource(blobUrl);
      if (originalSource) {
        const origPos = await mapToOriginalPosition(originalSource, col);
        if (origPos) {
          replacement = `${sourceUrl}:${origPos.line}`;
        } else {
          const adjustedLine = Math.max(1, col - 1);
          replacement = `${sourceUrl}:${adjustedLine}`;
        }
      } else {
        const adjustedLine = Math.max(1, col - 1);
        replacement = `${sourceUrl}:${adjustedLine}`;
      }
    } else {
      replacement = sourceUrl;
    }

    result = result.slice(0, startIdx) + replacement + result.slice(startIdx + fullMatch.length);
  }

  return result;
}

/** Extract the first blob URL with line/col info from an error stack */
export function extractBlobLocation(
  stack: string,
  instance: ModuleTSX,
): { blobUrl: string; line: number; col?: number } | undefined {
  const matches = stack.matchAll(/blob:https?:\/\/[^\s"')]+/g);
  for (const [match] of matches) {
    let blobUrl = match;

    const colMatch = blobUrl.match(/^(.*):(\d+)$/);
    if (colMatch) {
      const candidate = colMatch[1];
      const num = Number(colMatch[2]);
      if (instance.getSourceUrlByBlob(candidate)) {
        return { blobUrl: candidate, line: num, col: undefined };
      }
      const lineMatch = candidate.match(/^(.*):(\d+)$/);
      if (lineMatch && instance.getSourceUrlByBlob(lineMatch[1])) {
        return { blobUrl: lineMatch[1], line: Number(lineMatch[2]), col: num };
      }
    }

    if (instance.getSourceUrlByBlob(blobUrl)) {
      return { blobUrl, line: 1 };
    }
  }
  return undefined;
}

/** Rewrite blob URLs in the stack trace, mapping compiled positions back to original source */
export async function rewriteStack(stack: string, instance: ModuleTSX): Promise<string> {
  const blobPattern = /blob:https?:\/\/[^\s"')]+/g;
  const matches = [...stack.matchAll(blobPattern)];
  if (matches.length === 0) return stack;

  let result = stack;
  // Process matches in reverse to preserve offsets
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const fullMatch = match[0];
    const startIdx = match.index!;

    // Parse blob URL and extract line:col
    let blobUrl = fullMatch;
    let line: number | undefined;
    let col: number | undefined;

    const colMatch = blobUrl.match(/^(.*):(\d+)$/);
    if (colMatch) {
      const candidate = colMatch[1];
      const num = Number(colMatch[2]);
      if (instance.getSourceUrlByBlob(candidate)) {
        blobUrl = candidate;
        line = num;
      } else {
        const lineMatch = candidate.match(/^(.*):(\d+)$/);
        if (lineMatch && instance.getSourceUrlByBlob(lineMatch[1])) {
          blobUrl = lineMatch[1];
          line = Number(lineMatch[2]);
          col = num;
        }
      }
    }

    const sourceUrl = instance.getSourceUrlByBlob(blobUrl);
    if (!sourceUrl) continue;

    let replacement: string;
    if (line != null) {
      const originalSource = instance.getOriginalSource(blobUrl);
      if (originalSource) {
        const origPos = await mapToOriginalPosition(originalSource, line, col);
        if (origPos) {
          replacement = col != null
            ? `${sourceUrl}:${origPos.line}:${origPos.col}`
            : `${sourceUrl}:${origPos.line}`;
        } else {
          // Fallback: adjust for prepended import.meta.url line
          const adjustedLine = Math.max(1, line - 1);
          replacement = col != null
            ? `${sourceUrl}:${adjustedLine}:${col}`
            : `${sourceUrl}:${adjustedLine}`;
        }
      } else {
        const adjustedLine = Math.max(1, line - 1);
        replacement = col != null
          ? `${sourceUrl}:${adjustedLine}:${col}`
          : `${sourceUrl}:${adjustedLine}`;
      }
    } else {
      replacement = sourceUrl;
    }

    result = result.slice(0, startIdx) + replacement + result.slice(startIdx + fullMatch.length);
  }

  return result;
}

/** Fetch the compiled code from a blob URL */
async function fetchBlobContent(blobUrl: string): Promise<string | undefined> {
  try {
    const res = await fetch(blobUrl);
    return await res.text();
  } catch {
    return undefined;
  }
}

/** Check if the error is a failed dynamic import (e.g. a static import inside the module can't be fetched) */
function isFailedDynamicImportError(error: Error): boolean {
  return /failed to fetch dynamically imported module/i.test(error.message);
}

/**
 * When a dynamic import fails because a static import inside it can't be fetched,
 * parse the compiled code to find all static import specifiers, test them,
 * and return the line number of the one that failed.
 */
async function findFailedImportLine(
  code: string,
): Promise<{ line: number; col: number; specifier: string } | undefined> {
  const sourceFile = createSourceFile(code, "__error_check__.js");

  // Collect all static import specifiers with their line positions
  const imports: { specifier: string; line: number; col: number }[] = [];
  const visit = (node: ts.Node) => {
    if (
      typescript.isImportDeclaration(node) &&
      node.moduleSpecifier &&
      typescript.isStringLiteral(node.moduleSpecifier)
    ) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.moduleSpecifier.getStart(sourceFile));
      imports.push({
        specifier: node.moduleSpecifier.text,
        line: line + 1, // 1-indexed
        col: character + 1,
      });
    }
    if (
      typescript.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      typescript.isStringLiteral(node.moduleSpecifier)
    ) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.moduleSpecifier.getStart(sourceFile));
      imports.push({
        specifier: node.moduleSpecifier.text,
        line: line + 1,
        col: character + 1,
      });
    }
    typescript.forEachChild(node, visit);
  };
  visit(sourceFile);

  // Filter out blob URLs - they are internal module-tsx URLs and always fetchable
  const externalImports = imports.filter((imp) => !imp.specifier.startsWith("blob:"));

  // Test each import URL to find the one that fails
  const results = await Promise.all(
    externalImports.map(async (imp) => {
      try {
        const res = await fetch(imp.specifier, { method: "HEAD" });
        return { ...imp, ok: res.ok };
      } catch {
        return { ...imp, ok: false };
      }
    }),
  );

  const failed = results.find((r) => !r.ok);
  return failed ? { line: failed.line, col: failed.col, specifier: failed.specifier } : undefined;
}

/** Generate a code frame string with context lines around the error line */
function generateCodeFrame(code: string, errorLine: number, errorCol?: number, contextLines = 3): HTMLElement {
  const lines = code.split("\n");
  const adjustedErrorLine = errorLine;
  const start = Math.max(0, adjustedErrorLine - 1 - contextLines);
  const end = Math.min(lines.length, adjustedErrorLine + contextLines);

  const frame = Object.assign(document.createElement("pre"), {
    className: "frame",
  });

  for (let i = start; i < end; i++) {
    const lineNum = i + 1;
    const isErrorLine = lineNum === adjustedErrorLine;

    const lineEl = Object.assign(document.createElement("div"), {
      className: isErrorLine ? "frame-line frame-line-error" : "frame-line",
    });

    const lineNumSpan = Object.assign(document.createElement("span"), {
      className: "frame-line-number",
      textContent: String(lineNum),
    });

    const lineContent = Object.assign(document.createElement("span"), {
      textContent: lines[i],
    });

    lineEl.appendChild(lineNumSpan);
    lineEl.appendChild(lineContent);
    frame.appendChild(lineEl);

    // Add underline indicator for the error column
    if (isErrorLine && errorCol != null) {
      const underlineEl = Object.assign(document.createElement("div"), {
        className: "frame-line frame-underline",
      });
      const padSpan = Object.assign(document.createElement("span"), {
        className: "frame-line-number",
        textContent: "",
      });
      const caretPad = " ".repeat(Math.max(0, errorCol - 1)) + "^";
      const caretSpan = Object.assign(document.createElement("span"), {
        textContent: caretPad,
      });
      underlineEl.appendChild(padSpan);
      underlineEl.appendChild(caretSpan);
      frame.appendChild(underlineEl);
    }
  }

  return frame;
}

async function showErrorOverlay(id: string, error: unknown, instance: ModuleTSX): Promise<void> {
  // Remove existing overlay if present
  const existing = document.getElementById(overlayId);
  if (existing) {
    existing.remove();
  }

  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : String(error));

  let message = await replaceBlobUrls(err.message || "Unknown error", instance);
  const stack = await rewriteStack(err.stack || "", instance);

  // Try to extract code frame from the error
  let codeFrameEl: HTMLElement | undefined;
  const blobLocation = extractBlobLocation(err.stack || "", instance);

  if (isFailedDynamicImportError(err) && blobLocation) {
    // Dynamic import failed - find which static import inside the module can't be fetched
    const originalSource = instance.getOriginalSource(blobLocation.blobUrl);
    const code = await fetchBlobContent(blobLocation.blobUrl);
    if (code) {
      const failedImport = await findFailedImportLine(code);
      if (failedImport && originalSource) {
        // Map back to original source position
        const origPos = await mapToOriginalPosition(originalSource, failedImport.line, failedImport.col);
        message = `Failed to load module: ${failedImport.specifier}`;
        if (origPos) {
          codeFrameEl = generateCodeFrame(originalSource, origPos.line, origPos.col);
        } else {
          codeFrameEl = generateCodeFrame(originalSource, failedImport.line, failedImport.col);
        }
      } else if (failedImport) {
        message = `Failed to load module: ${failedImport.specifier}`;
        codeFrameEl = generateCodeFrame(code, failedImport.line, failedImport.col);
      } else {
        codeFrameEl = generateCodeFrame(originalSource ?? code, blobLocation.line, blobLocation.col);
      }
    }
  } else if (blobLocation) {
    const originalSource = instance.getOriginalSource(blobLocation.blobUrl);
    if (originalSource) {
      // Map compiled position back to original source
      const origPos = await mapToOriginalPosition(originalSource, blobLocation.line, blobLocation.col);
      if (origPos) {
        codeFrameEl = generateCodeFrame(originalSource, origPos.line, origPos.col);
      } else {
        codeFrameEl = generateCodeFrame(originalSource, blobLocation.line, blobLocation.col);
      }
    } else {
      const code = await fetchBlobContent(blobLocation.blobUrl);
      if (code) {
        codeFrameEl = generateCodeFrame(code, blobLocation.line, blobLocation.col);
      }
    }
  }

  // Create overlay host
  const host = Object.assign(document.createElement("div"), {
    id: overlayId,
  });
  Object.assign(host.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    zIndex: "99999",
  });
  document.body.appendChild(host);

  const root = host.attachShadow({ mode: "open" });

  // Build template
  const backdrop = Object.assign(document.createElement("div"), {
    className: "backdrop",
  });

  const window_ = Object.assign(document.createElement("div"), {
    className: "window",
  });

  // Plugin/source line
  const messagePre = Object.assign(document.createElement("pre"), {
    className: "message",
  });

  const pluginSpan = Object.assign(document.createElement("span"), {
    className: "plugin",
    textContent: "[module-tsx] ",
  });

  const messageBody = Object.assign(document.createElement("span"), {
    className: "message-body",
    textContent: message,
  });

  messagePre.appendChild(pluginSpan);
  messagePre.appendChild(messageBody);

  // File info
  const filePre = Object.assign(document.createElement("pre"), {
    className: "file",
    textContent: id,
  });

  // Stack trace
  const stackPre = Object.assign(document.createElement("pre"), {
    className: "stack",
    textContent: stack,
  });

  // Tip
  const tip = Object.assign(document.createElement("div"), {
    className: "tip",
    innerHTML: "Click outside, press <kbd>Esc</kbd> key, or fix the code to dismiss.",
  });

  // Copy button
  const copyBtn = Object.assign(document.createElement("button"), {
    className: "copy-btn",
    textContent: "Copy",
  });
  copyBtn.addEventListener("click", () => {
    const text = [message, id, stack].filter(Boolean).join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = "Copied!";
      copyBtn.classList.add("copied");
      setTimeout(() => {
        copyBtn.textContent = "Copy";
        copyBtn.classList.remove("copied");
      }, 2000);
    });
  });

  const header = Object.assign(document.createElement("div"), {
    className: "header",
  });
  header.appendChild(messagePre);
  header.appendChild(copyBtn);

  window_.appendChild(header);
  window_.appendChild(filePre);
  if (codeFrameEl) {
    window_.appendChild(codeFrameEl);
  }
  window_.appendChild(stackPre);
  window_.appendChild(tip);
  backdrop.appendChild(window_);

  // Style
  const style = Object.assign(document.createElement("style"), {
    textContent: overlayStyle,
  });

  root.appendChild(backdrop);
  root.appendChild(style);

  // Close handlers
  const close = () => {
    host.remove();
    document.removeEventListener("keydown", onKeydown);
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape" || e.code === "Escape") {
      close();
    }
  };

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) {
      close();
    }
  });

  window_.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  document.addEventListener("keydown", onKeydown);
}
