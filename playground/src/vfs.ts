import { createSeedFiles } from "./seed.ts";

const STORAGE_KEY = "module-tsx-playground-vfs";

/** Synthetic origin used as the base URL for the VFS inside the preview iframe. */
export const VFS_ORIGIN = "https://vfs.local/";

/**
 * Placeholder file name that keeps an otherwise-empty directory alive.
 *
 * The `@pierre/trees` component only shows a directory when it is the ancestor
 * of some path, so an empty folder needs a sentinel entry. These placeholders
 * are hidden from the editor/preview file listing.
 */
export const DIR_KEEP = ".keep";

export type VFSListener = () => void;

/**
 * A tiny in-browser virtual file system.
 *
 * It is the single source of truth for the playground: the file tree renders
 * `listTreePaths()`, the editor writes back with `write()`, and the preview
 * iframe reads file contents through `read()` / `resolve()` to feed module-tsx.
 */
export class VFS {
  private files = new Map<string, string>();
  private listeners = new Set<VFSListener>();

  constructor(initial?: Record<string, string>) {
    const source = initial ?? this.loadFromStorage() ?? createSeedFiles();
    for (const [path, content] of Object.entries(source)) {
      this.files.set(normalizePath(path), content);
    }
  }

  // --- reads ---------------------------------------------------------------

  /**
   * Paths to feed the tree. Real files are always included. A directory
   * placeholder (`.keep`) is only kept when it is the *sole* reason its
   * directory exists — i.e. the folder is otherwise empty — so placeholders
   * never show up as visible files next to real content. Sorted.
   */
  listTreePaths(): string[] {
    const all = Array.from(this.files.keys());
    const realFiles = all.filter((p) => !isKeep(p));
    // Directories that already contain a real file don't need a placeholder.
    const dirsWithFiles = new Set<string>();
    for (const file of realFiles) {
      let dir = dirname(file);
      while (dir) {
        dirsWithFiles.add(dir);
        dir = dirname(dir);
      }
    }
    const keeps = all.filter((p) => {
      if (!isKeep(p)) return false;
      const dir = dirname(p);
      return !dirsWithFiles.has(dir);
    });
    return [...realFiles, ...keeps].sort();
  }

  has(path: string): boolean {
    return this.files.has(normalizePath(path));
  }

  /** Whether `path` is (or is a prefix of) a directory in the tree. */
  isDir(path: string): boolean {
    const key = normalizePath(path);
    if (this.files.has(key)) return false; // it's a file
    const prefix = key + "/";
    for (const existing of this.files.keys()) {
      if (existing.startsWith(prefix)) return true;
    }
    return false;
  }

  read(path: string): string | undefined {
    return this.files.get(normalizePath(path));
  }

  toJSON(): Record<string, string> {
    return Object.fromEntries(this.files);
  }

  /**
   * Map a full fetch URL (as seen by module-tsx inside the iframe) back to a
   * VFS path. Returns `undefined` when the URL is not part of the VFS (e.g. a
   * bare specifier resolved to a CDN).
   */
  resolve(fullUrl: string): string | undefined {
    if (!fullUrl.startsWith(VFS_ORIGIN)) return undefined;
    const path = normalizePath(fullUrl.slice(VFS_ORIGIN.length));
    return this.files.has(path) ? path : undefined;
  }

  // --- mutations -----------------------------------------------------------

  write(path: string, content: string): void {
    const key = normalizePath(path);
    if (this.files.get(key) === content) return;
    this.files.set(key, content);
    this.commit();
  }

  add(path: string, content = ""): void {
    const key = normalizePath(path);
    if (this.files.has(key)) return;
    this.files.set(key, content);
    this.commit();
  }

  /** Create an (empty) directory, backed by a hidden `.keep` placeholder. */
  addDir(path: string): void {
    const key = normalizePath(path);
    if (!key) return;
    const keep = `${key}/${DIR_KEEP}`;
    if (this.files.has(keep) || this.isDir(key)) return;
    this.files.set(keep, "");
    this.commit();
  }

  remove(path: string): void {
    const key = normalizePath(path);
    // Remove the file itself and, if it's a directory prefix, its descendants.
    const prefix = key + "/";
    let changed = false;
    for (const existing of Array.from(this.files.keys())) {
      if (existing === key || existing.startsWith(prefix)) {
        this.files.delete(existing);
        changed = true;
      }
    }
    if (changed) this.commit();
  }

  move(from: string, to: string): void {
    const fromKey = normalizePath(from);
    const toKey = normalizePath(to);
    if (fromKey === toKey) return;

    const fromPrefix = fromKey + "/";
    const toPrefix = toKey + "/";
    const moves: Array<[string, string]> = [];

    for (const existing of this.files.keys()) {
      if (existing === fromKey) {
        moves.push([existing, toKey]);
      } else if (existing.startsWith(fromPrefix)) {
        moves.push([existing, toPrefix + existing.slice(fromPrefix.length)]);
      }
    }

    if (moves.length === 0) return;

    for (const [oldPath, newPath] of moves) {
      const content = this.files.get(oldPath)!;
      this.files.delete(oldPath);
      this.files.set(newPath, content);
    }
    this.commit();
  }

  /** Replace the entire file system with the seed content. */
  reset(): void {
    this.files.clear();
    for (const [path, content] of Object.entries(createSeedFiles())) {
      this.files.set(normalizePath(path), content);
    }
    this.commit();
  }

  // --- subscriptions -------------------------------------------------------

  subscribe(listener: VFSListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private commit(): void {
    this.persist();
    for (const listener of this.listeners) listener();
  }

  // --- persistence ---------------------------------------------------------

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.toJSON()));
    } catch {
      // storage may be unavailable (private mode, quota); ignore.
    }
  }

  private loadFromStorage(): Record<string, string> | undefined {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return undefined;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, string>;
      }
    } catch {
      // ignore malformed storage.
    }
    return undefined;
  }
}

/** Whether a path is a directory-keeping placeholder. */
export function isKeep(path: string): boolean {
  return path === DIR_KEEP || path.endsWith(`/${DIR_KEEP}`);
}

/** Normalize a path: strip leading `./` and `/`, collapse duplicate slashes. */
export function normalizePath(path: string): string {
  return path
    .replace(/^\.?\//, "")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

/** Infer a display/highlighting filename from a VFS path (its basename). */
export function basename(path: string): string {
  const parts = normalizePath(path).split("/");
  return parts[parts.length - 1] || path;
}

/** The parent directory of a path, or "" for top-level. */
export function dirname(path: string): string {
  const key = normalizePath(path);
  const idx = key.lastIndexOf("/");
  return idx === -1 ? "" : key.slice(0, idx);
}

/** Join a directory and a name into a normalized path. */
export function joinPath(dir: string, name: string): string {
  return normalizePath(dir ? `${dir}/${name}` : name);
}
