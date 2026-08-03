import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VFS } from "./vfs.ts";
import { FileTreePane } from "./FileTreePane.tsx";
import { EditorPane } from "./EditorPane.tsx";
import { Preview } from "./preview.tsx";
import { PlayIcon, RestartIcon } from "./icons.tsx";

interface LogEntry {
  type: string;
  payload: unknown;
}

export default function App() {
  // One VFS instance for the whole app lifetime.
  const vfs = useMemo(() => new VFS(), []);
  const [activePath, setActivePath] = useState<string | null>("App.tsx");
  const [runToken, setRunToken] = useState(0);
  const [autoRun, setAutoRun] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const run = useCallback(() => {
    setLogs([]);
    setRunToken((t) => t + 1);
  }, []);

  // Debounced auto-run when the VFS changes.
  const autoRunRef = useRef(autoRun);
  autoRunRef.current = autoRun;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = vfs.subscribe(() => {
      if (!autoRunRef.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => run(), 500);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [vfs, run]);

  // Initial run on mount.
  useEffect(() => {
    run();
  }, [run]);

  // Expose the VFS for debugging / automation in dev.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { vfs?: VFS }).vfs = vfs;
  }, [vfs]);

  const onPreviewEvent = useCallback((type: string, payload: unknown) => {
    setLogs((prev) => [...prev.slice(-99), { type, payload }]);
  }, []);

  return (
    <div className="playground">
      <div className="panes">
        <section className="pane pane-files">
          <FileTreePane vfs={vfs} activePath={activePath} onSelect={setActivePath} />
        </section>

        <section className="pane pane-editor">
          <EditorPane vfs={vfs} activePath={activePath} />
        </section>

        <section className="pane pane-preview">
          <div className="pane-toolbar">
            <span className="pane-title">Preview</span>
            <div className="spacer" />
            <label className="auto-run">
              <input type="checkbox" checked={autoRun} onChange={(e) => setAutoRun(e.target.checked)} />
              Auto&nbsp;run
            </label>
            <button className="icon-button" type="button" onClick={run}>
              <PlayIcon />
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => {
                if (window.confirm("Reset the file system to the seed content?")) {
                  vfs.reset();
                  setActivePath("App.tsx");
                  run();
                }
              }}
            >
              <RestartIcon />
            </button>
          </div>
          <div className="preview-host">
            <Preview vfs={vfs} runToken={runToken} onEvent={onPreviewEvent} />
          </div>
          <div className="console">
            {logs.length === 0 ? (
              <div className="console-empty">No events yet.</div>
            ) : (
              logs.map((log, i) => (
                <pre key={i} className={log.type.endsWith(":error") ? "console-line error" : "console-line"}>
                  {log.type}: {JSON.stringify(log.payload)}
                </pre>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
