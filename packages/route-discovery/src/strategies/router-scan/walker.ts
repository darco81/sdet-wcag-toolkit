/**
 * Minimal file-system walker for router-scan detectors.
 *
 * Each detector expresses interest in one or more sub-trees (e.g.
 * `src/pages` for Astro, `app` + `pages` for Next.js). The walker
 * recurses each tree, collects files matching a predicate, and returns
 * paths relative to the project root with forward slashes - matching
 * the `source` provenance format used in `DiscoveredRoute`.
 *
 * Implemented on top of `node:fs/promises` (no glob dependency) so the
 * package keeps its zero-runtime-deps profile outside of fast-xml-parser.
 *
 * The reader interface is injectable so detector tests can run against
 * in-memory fixtures.
 */

import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

export interface WalkerEntry {
  /** Project-root-relative path with forward slashes. */
  readonly path: string;
}

export type FileFilter = (relPath: string) => boolean;

export interface DirectoryReader {
  /**
   * List children of `path`. Each entry includes its name and whether
   * it is a directory. Returns an empty array when the directory does
   * not exist - callers shouldn't have to differentiate "missing" from
   * "empty".
   */
  readDir(path: string): Promise<readonly DirEntry[]>;
}

export interface DirEntry {
  readonly name: string;
  readonly isDirectory: boolean;
}

/** Default ignore set - applied to every walk regardless of detector. */
export const DEFAULT_WALK_IGNORE: readonly string[] = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.astro',
  '.cache',
  'public',
  'static',
];

export interface WalkOptions {
  /** Project root. All returned paths are relative to this. */
  readonly rootDir: string;
  /** Sub-tree to walk, relative to rootDir (e.g. "src/pages"). */
  readonly subTree: string;
  /** Predicate: which files to include. */
  readonly include: FileFilter;
  /** Reader implementation. Defaults to `node:fs/promises` based reader. */
  readonly reader?: DirectoryReader;
  /** Directory names to skip during recursion. Defaults to `DEFAULT_WALK_IGNORE`. */
  readonly ignore?: readonly string[];
}

/**
 * Walk a sub-tree of the project root and return every file matched by
 * `include`. The sub-tree may not exist - that's fine, walker returns
 * `[]` rather than throwing, since detectors run speculatively (e.g.
 * the Next.js detector probes both `app/` and `pages/`).
 */
export async function walkSubTree(options: WalkOptions): Promise<readonly WalkerEntry[]> {
  const reader = options.reader ?? defaultDirectoryReader;
  const ignore = new Set(options.ignore ?? DEFAULT_WALK_IGNORE);
  const out: WalkerEntry[] = [];
  const start = join(options.rootDir, options.subTree);
  await walk(reader, options.rootDir, start, ignore, options.include, out);
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

async function walk(
  reader: DirectoryReader,
  root: string,
  current: string,
  ignore: Set<string>,
  include: FileFilter,
  out: WalkerEntry[],
): Promise<void> {
  let entries: readonly DirEntry[];
  try {
    entries = await reader.readDir(current);
  } catch {
    return; // Missing sub-tree - tolerated.
  }

  for (const entry of entries) {
    if (ignore.has(entry.name)) continue;
    const full = join(current, entry.name);
    if (entry.isDirectory) {
      await walk(reader, root, full, ignore, include, out);
      continue;
    }
    const rel = relative(root, full).split(sep).join('/');
    if (include(rel)) {
      out.push({ path: rel });
    }
  }
}

const defaultDirectoryReader: DirectoryReader = {
  async readDir(path) {
    let entries;
    try {
      entries = await readdir(path, { withFileTypes: true });
    } catch {
      return [];
    }
    return entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory() }));
  },
};

/**
 * Build an `include` predicate that matches files by extension.
 * Convenience for the common "find every `.astro` / `.vue` / etc."
 * case.
 */
export function extensionFilter(extensions: readonly string[]): FileFilter {
  const set = new Set(extensions.map((e) => (e.startsWith('.') ? e : `.${e}`).toLowerCase()));
  return (path) => {
    const dot = path.lastIndexOf('.');
    if (dot < 0) return false;
    return set.has(path.slice(dot).toLowerCase());
  };
}

/**
 * Build a `DirectoryReader` from a flat record of `{ "rel/path": "content" }`.
 * Used in tests so detectors can run against synthesised project trees
 * without touching the disk.
 *
 * The reader is rooted at `rootDir`: every read resolves the requested
 * absolute path back to its location relative to `rootDir`, so tests
 * can keep the file map readable (`'src/pages/index.astro'`) without
 * repeating the rootDir prefix.
 */
export function createInMemoryReader(
  rootDir: string,
  files: Record<string, string>,
): DirectoryReader {
  type Tree = Map<string, Tree | null>;
  const root: Tree = new Map();
  const normalizedRoot = normalize(rootDir);

  function insert(parts: readonly string[], current: Tree): void {
    if (parts.length === 0) return;
    const [head, ...rest] = parts;
    if (head === undefined) return;
    if (rest.length === 0) {
      current.set(head, null);
      return;
    }
    let next = current.get(head);
    if (next === null || next === undefined) {
      next = new Map();
      current.set(head, next);
    }
    insert(rest, next);
  }

  for (const path of Object.keys(files)) {
    insert(splitPath(path), root);
  }

  function lookup(path: string): Tree | null | undefined {
    const normalized = normalize(path);
    if (!normalized.startsWith(normalizedRoot)) {
      // Outside of rootDir → treat as nonexistent so callers see [].
      return undefined;
    }
    const remainder = normalized.slice(normalizedRoot.length);
    const parts = splitPath(remainder);
    let current: Tree | null | undefined = root;
    for (const part of parts) {
      if (!(current instanceof Map)) return undefined;
      current = current.get(part);
    }
    return current;
  }

  return {
    async readDir(path) {
      const node = lookup(path);
      if (!(node instanceof Map)) return [];
      return Array.from(node.entries()).map(([name, child]) => ({
        name,
        isDirectory: child instanceof Map,
      }));
    },
  };
}

function splitPath(path: string): string[] {
  return path.split(/[/\\]/).filter(Boolean);
}

function normalize(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '');
}
