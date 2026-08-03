import { useEffect, useRef } from "react";
import { FileTree, useFileTree } from "@pierre/trees/react";
import type { ContextMenuItem, ContextMenuOpenContext } from "@pierre/trees";
import { VFS, basename, dirname, joinPath, isKeep } from "./vfs.ts";
import { FilePlusIcon, FolderPlusIcon } from "./icons.tsx";

interface FileTreePaneProps {
  vfs: VFS;
  activePath: string | null;
  onSelect: (path: string | null) => void;
}

export function FileTreePane({ vfs, activePath, onSelect }: FileTreePaneProps) {
  // Keep a live ref so the model's (create-once) callbacks always see fresh values.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const { model } = useFileTree({
    paths: vfs.listTreePaths(),
    initialExpansion: "open",
    initialSelectedPaths: activePath ? [activePath] : [],
    icons: {
      set: "complete",
      colored: true,
    },
    // Directory placeholders keep empty folders alive but must stay invisible.
    unsafeCSS: `[data-item-path$="/.keep"] { display: none !important; }`,
    renaming: {
      onRename(event) {
        vfs.move(event.sourcePath, event.destinationPath);
        if (!vfs.isDir(event.destinationPath)) {
          onSelectRef.current(event.destinationPath);
        }
      },
    },
    dragAndDrop: {
      onDropComplete(event) {
        const target = event.target.directoryPath ?? "";
        for (const from of event.draggedPaths) {
          vfs.move(from, joinPath(target, basename(from)));
        }
      },
    },
    onSelectionChange(selectedPaths) {
      const next = selectedPaths[0] ?? null;
      // Only real files (not directories or placeholders) open in the editor.
      if (next && vfs.has(next) && !isKeep(next)) {
        onSelectRef.current(next);
      }
    },
  });

  // Sync the tree's paths whenever the VFS structure changes.
  useEffect(() => {
    const sync = () => model.resetPaths(vfs.listTreePaths());
    return vfs.subscribe(sync);
  }, [vfs, model]);

  const beginRename = (path: string) => model.startRenaming(path);

  const renderContextMenu = (item: ContextMenuItem, context: ContextMenuOpenContext) => (
    <ContextMenu vfs={vfs} item={item} context={context} onSelect={onSelectRef.current} beginRename={beginRename} />
  );

  return (
    <div className="file-tree-pane">
      <div className="pane-toolbar">
        <span className="pane-title pane-brand">module-tsx</span>
        <div className="spacer" />
        <div className="toolbar-actions">
          <button
            className="icon-button"
            type="button"
            title="New file at root"
            onClick={() => createFile(vfs, "", onSelectRef.current, beginRename)}
          >
            <FilePlusIcon />
          </button>
          <button
            className="icon-button"
            type="button"
            title="New folder at root"
            onClick={() => createFolder(vfs, "", beginRename)}
          >
            <FolderPlusIcon />
          </button>
        </div>
      </div>
      <FileTree model={model} className="file-tree" renderContextMenu={renderContextMenu} />
    </div>
  );
}

// --- context menu ----------------------------------------------------------

interface ContextMenuProps {
  vfs: VFS;
  item: ContextMenuItem;
  context: ContextMenuOpenContext;
  onSelect: (path: string | null) => void;
  beginRename: (path: string) => void;
}

function ContextMenu({ vfs, item, context, onSelect, beginRename }: ContextMenuProps) {
  // For a directory, new items go inside it; for a file, alongside it.
  const baseDir = item.kind === "directory" ? item.path : dirname(item.path);

  const run = (fn: () => void) => {
    fn();
    context.close();
  };

  return (
    <div className="ctx-menu" role="menu">
      <button type="button" role="menuitem" onClick={() => run(() => createFile(vfs, baseDir, onSelect, beginRename))}>
        New File
      </button>
      <button type="button" role="menuitem" onClick={() => run(() => createFolder(vfs, baseDir, beginRename))}>
        New Folder
      </button>
      <div className="ctx-sep" />
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          // Transfer focus into the tree's own inline rename input, so the
          // menu close path must not steal focus back to the row first.
          context.close({ restoreFocus: false });
          beginRename(item.path);
        }}
      >
        Rename
      </button>
      <button
        type="button"
        role="menuitem"
        className="danger"
        onClick={() =>
          run(() => {
            if (!window.confirm(`Delete "${item.path}"?`)) return;
            vfs.remove(item.path);
            onSelect(null);
          })
        }
      >
        Delete
      </button>
    </div>
  );
}

// --- helpers ---------------------------------------------------------------

/** Pick a unique "untitled" path in `dir`, appending a counter if needed. */
function uniquePath(vfs: VFS, dir: string, base: string): string {
  let path = joinPath(dir, base);
  let n = 1;
  while (vfs.has(path) || vfs.isDir(path)) {
    path = joinPath(dir, `${base}-${n++}`);
  }
  return path;
}

function createFile(
  vfs: VFS,
  dir: string,
  onSelect: (path: string | null) => void,
  beginRename: (path: string) => void,
) {
  const path = uniquePath(vfs, dir, "untitled");
  vfs.add(path, "");
  onSelect(path);
  // Match the official UX: create the row, then rename it inline.
  requestAnimationFrame(() => beginRename(path));
}

function createFolder(vfs: VFS, dir: string, beginRename: (path: string) => void) {
  const path = uniquePath(vfs, dir, "folder");
  vfs.addDir(path);
  requestAnimationFrame(() => beginRename(path));
}
