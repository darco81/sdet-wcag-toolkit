/**
 * Orchestrator: holds a registry of analyzers and runs them against an
 * {@link AnalysisContext}. Deduplicates findings by id so two analyzers
 * flagging the same (SC, location) don't produce double noise.
 */

import type { WcagFinding } from '@sdet-wcag-toolkit/core';

import type { AnalysisContext, Analyzer } from './types.js';

export class StaticAnalyzerOrchestrator {
  private readonly analyzers = new Map<string, Analyzer>();

  register(analyzer: Analyzer): this {
    if (this.analyzers.has(analyzer.name)) {
      throw new Error(`Analyzer with name "${analyzer.name}" is already registered.`);
    }
    this.analyzers.set(analyzer.name, analyzer);
    return this;
  }

  /** Returns registered analyzer names in registration order. */
  list(): string[] {
    return Array.from(this.analyzers.keys());
  }

  /**
   * Run every registered analyzer against `context` and return the merged,
   * deduplicated findings. Order of analyzer dispatch matches registration.
   */
  run(context: AnalysisContext): WcagFinding[] {
    const merged: WcagFinding[] = [];
    const seen = new Set<string>();
    for (const analyzer of this.analyzers.values()) {
      for (const finding of analyzer.analyze(context)) {
        if (seen.has(finding.id)) continue;
        seen.add(finding.id);
        merged.push(finding);
      }
    }
    return merged;
  }
}

/** Helper: build an empty context. Useful in tests. */
export function emptyContext(): AnalysisContext {
  return { html: [], jsx: [], tsx: [], css: [] };
}
