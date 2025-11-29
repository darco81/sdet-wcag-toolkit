/**
 * Local types for the static analyzer.
 *
 * An `Analyzer` is a small, focused unit that looks at zero or more source
 * files and returns findings. The orchestrator loads files once, groups them
 * by kind, and dispatches them to registered analyzers.
 */

import type { WcagFinding } from '@sdet-wcag-toolkit/core';

/** Supported source file kinds. Determines which parser the loader uses. */
export type SourceKind = 'html' | 'jsx' | 'tsx' | 'css';

/** A single file loaded into memory, ready to be analyzed. */
export interface SourceFile {
  /** Workspace-relative path. */
  readonly path: string;
  readonly kind: SourceKind;
  readonly content: string;
}

/**
 * Context passed to each analyzer invocation. Grouped by kind so analyzers
 * don't have to filter themselves. Empty arrays are fine - analyzers should
 * early-return if their kind is missing.
 */
export interface AnalysisContext {
  readonly html: readonly SourceFile[];
  readonly jsx: readonly SourceFile[];
  readonly tsx: readonly SourceFile[];
  readonly css: readonly SourceFile[];
}

/**
 * Contract every analyzer must satisfy.
 *
 * `name` is a stable identifier surfaced in reports and logs. `analyze` is
 * synchronous for now - all current analyzers work on pre-loaded content.
 * If an analyzer ever needs async work (network, shelling out), we'll
 * relax this to `Promise<WcagFinding[]>`.
 */
export interface Analyzer {
  readonly name: string;
  analyze(context: AnalysisContext): WcagFinding[];
}
