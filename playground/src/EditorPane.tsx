import { useCallback, useMemo, useRef } from "react";
import { EditProvider, File } from "@pierre/diffs/react";
import { Editor } from "@pierre/diffs/edit";
import { VFS, basename } from "./vfs.ts";

interface EditorPaneProps {
  vfs: VFS;
  activePath: string | null;
}

export function EditorPane({ vfs, activePath }: EditorPaneProps) {
  const createEditor = useCallback(
    (options: ConstructorParameters<typeof Editor>[0]) => new Editor(options),
    [],
  );

  // Debounce writes back into the VFS so typing stays smooth and the preview
  // auto-refresh isn't triggered on every keystroke.
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleWrite = useCallback(
    (path: string, contents: string) => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
      writeTimer.current = setTimeout(() => {
        vfs.write(path, contents);
      }, 300);
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
        <EditProvider createEditor={createEditor}>
          <File
            key={activePath}
            file={file}
            edit
            editorOptions={{
              persistState: true,
              onChange(changed) {
                scheduleWrite(activePath, changed.contents);
              },
            }}
          />
        </EditProvider>
      </div>
    </div>
  );
}
