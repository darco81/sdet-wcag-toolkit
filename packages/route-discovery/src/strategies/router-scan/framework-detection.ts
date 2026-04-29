/**
 * Framework detection for the router-scan strategy.
 *
 * Reads `package.json` and identifies the dominant framework by looking
 * at production + dev dependencies. Detection order matters when a
 * project pulls in multiple frameworks (e.g. Astro projects often have
 * `react` as a peer dep for islands) - the first match in priority
 * order wins.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Frameworks the router-scan strategy can detect. Each value maps to a
 * detector module in `./detectors/`. `unknown` lets the strategy emit a
 * helpful warning instead of misclassifying a project.
 */
export type DetectedFramework =
  | 'nuxt'
  | 'next'
  | 'astro'
  | 'sveltekit'
  | 'remix'
  | 'gatsby'
  | 'vue'
  | 'react-router'
  | 'unknown';

export interface FrameworkDetection {
  readonly framework: DetectedFramework;
  /**
   * The dependency name that triggered detection - surfaced in warnings
   * and the dispatcher's `source` field for provenance.
   */
  readonly evidence: string;
  /**
   * Whether the framework was found in `dependencies` (production) vs
   * `devDependencies`. Mostly informational; some frameworks (Vite-only
   * projects) only ship router plugins as dev deps.
   */
  readonly scope: 'dependencies' | 'devDependencies';
}

/**
 * Detection priority. The order matters when a project pulls multiple
 * compatible frameworks - Nuxt always wraps Vue, SvelteKit wraps
 * Svelte, etc. Most-specific-first.
 */
const DETECTION_ORDER: ReadonlyArray<{
  framework: DetectedFramework;
  packages: readonly string[];
}> = [
  { framework: 'nuxt', packages: ['nuxt', 'nuxt3'] },
  { framework: 'sveltekit', packages: ['@sveltejs/kit'] },
  { framework: 'remix', packages: ['@remix-run/react', '@remix-run/node', '@remix-run/dev'] },
  { framework: 'gatsby', packages: ['gatsby'] },
  { framework: 'next', packages: ['next'] },
  { framework: 'astro', packages: ['astro'] },
  { framework: 'vue', packages: ['vue'] },
  { framework: 'react-router', packages: ['react-router-dom', 'react-router'] },
];

/**
 * Read a package.json from `rootDir` and return a single best-fit
 * framework detection. Returns `unknown` when the file is missing,
 * malformed, or contains none of the recognised dependencies.
 *
 * The reader is injectable so tests can avoid touching real disk.
 */
export async function detectFramework(
  rootDir: string,
  reader: (path: string) => Promise<string> = defaultReader,
): Promise<FrameworkDetection> {
  let raw: string;
  try {
    raw = await reader(join(rootDir, 'package.json'));
  } catch {
    return { framework: 'unknown', evidence: 'package.json not found', scope: 'dependencies' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      framework: 'unknown',
      evidence: 'package.json is malformed',
      scope: 'dependencies',
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      framework: 'unknown',
      evidence: 'package.json is not an object',
      scope: 'dependencies',
    };
  }

  const pkg = parsed as Record<string, unknown>;
  const deps = asDepsRecord(pkg.dependencies);
  const devDeps = asDepsRecord(pkg.devDependencies);

  for (const entry of DETECTION_ORDER) {
    for (const name of entry.packages) {
      if (deps[name] !== undefined) {
        return { framework: entry.framework, evidence: name, scope: 'dependencies' };
      }
      if (devDeps[name] !== undefined) {
        return { framework: entry.framework, evidence: name, scope: 'devDependencies' };
      }
    }
  }

  return {
    framework: 'unknown',
    evidence: 'no recognised framework in dependencies',
    scope: 'dependencies',
  };
}

function asDepsRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [name, version] of Object.entries(value as Record<string, unknown>)) {
    if (typeof version === 'string') {
      out[name] = version;
    }
  }
  return out;
}

async function defaultReader(path: string): Promise<string> {
  return readFile(path, 'utf8');
}
