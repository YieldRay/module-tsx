import { useCallback, useMemo, useRef } from "react";
import { EditProvider, File } from "@pierre/diffs/react";
import { Editor } from "@pierre/diffs/edit";
import { VFS, basename } from "./vfs.ts";

interface EditorPaneProps {
  vfs: VFS;
  activePath: string | null;
}

export function EditorPane({ vfs, activePath }: EditorPaneProps) {
  // Debounce writes back into the VFS so typing stays smooth and the preview
  // auto-refresh isn't triggered on every keystroke.
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleWrite = useCallback(
    (path: string, contents: string) => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
      writeTimer.current = setTimeout(() => {
        writeTimer.current = null;
        vfs.write(path, contents);
      }, 300);
    },
    [vfs],
  );

  // The active draft is auto-saved while typing; this synchronously commits
  // any pending write when the edit session ends (file switch or unmount).
  const flushWrite = useCallback(
    (path: string, contents: string) => {
      if (writeTimer.current) {
        clearTimeout(writeTimer.current);
        writeTimer.current = null;
      }
      vfs.write(path, contents);
    },
    [vfs],
  );

  const file = useMemo(() => {
    if (!activePath) return null;
    const contents = vfs.read(activePath);
    if (contents === undefined) return null;
    return {
      name: basename(activePath),
      contents,
      cacheKey: activePath,
    };
    // Re-read when the active path changes. Content changes come from the
    // editor itself, so we intentionally do not depend on `contents`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath, vfs]);

  if (!file || !activePath) {
    return (
      <div className="editor-pane editor-empty">
        <p>Select a file to edit.</p>
      </div>
    );
  }

  return (
    <div className="editor-pane">
      <div className="editor-host">
        <EditProvider
          createEditor={(editorType, options, editStateKey) => new Editor(editorType, options, editStateKey)}
        >
          <File
            key={activePath}
            file={file}
            edit
            // Retain the draft and its undo/redo history between editor
            // instances for the same file (`persistState` is gone in 1.4).
            editStateKey={activePath}
            onEditChange={(event) => {
              scheduleWrite(activePath, event.file.contents);
            }}
            onEditComplete={(event) => {
              flushWrite(activePath, event.file.contents);
              return "accept";
            }}
          />
        </EditProvider>
      </div>
    </div>
  );
}
