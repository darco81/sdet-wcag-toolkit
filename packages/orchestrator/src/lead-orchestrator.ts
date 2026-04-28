/**
 * Lead orchestrator - public v0.3.
 *
 * Dispatches the 5 WCAG specialist agents in parallel through a
 * runtime adapter, merges the findings, computes the v0.3 100-point
 * score and grade, and renders the dev + exec markdown reports.
 *
 * Single-runtime by design (public toolkit ships with the Claude
 * Code adapter only). Multi-runtime + deep dedupe + brain enrichment
 * stay in the Pro tier.
 */

import { scoreAndGrade, type WcagFinding, type WcagGrade } from '@sdet-wcag-toolkit/core';
import { formatDevReport, formatExecSummary } from '@sdet-wcag-toolkit/reporter';
import {
  SPECIALIST_AGENT_IDS,
  loadAllSystemPrompts,
  type AgentSpec,
  type RuntimeAdapter,
  type SpecialistAgentId,
} from '@sdet-wcag-toolkit/runtime-core';

/** One entry per AI specialist that returned a non-empty errors array. */
export interface AgentRuntimeError {
  readonly agentId: string;
  readonly messages: readonly string[];
}

export interface LeadOrchestratorOptions {
  /** Maximum agents running in parallel. Defaults to 5 (one per agent). */
  readonly parallelLimit?: number;
  /** Override the system prompt loader - primarily for tests. */
  readonly loadPrompts?: () => Promise<Record<SpecialistAgentId, string>>;
  /** Override the user-prompt builder. */
  readonly buildUserPrompt?: (id: SpecialistAgentId, targetPath: string) => string;
}

export interface LeadAuditResult {
  /** Merged findings from all 5 specialists, with the simple
   *  (ruleId, file, line, url) dedupe applied. */
  readonly findings: readonly WcagFinding[];
  /** v0.3 100-point score (higher is better). */
  readonly score: number;
  /** A-F grade derived from the score. */
  readonly grade: WcagGrade;
  /** Long-form developer markdown report. */
  readonly devReport: string;
  /** One-page executive summary markdown. */
  readonly execSummary: string;
  /** Errors surfaced by any agent during the run. */
  readonly agentErrors: readonly AgentRuntimeError[];
  /** Total wall-clock milliseconds the lead spent dispatching agents. */
  readonly durationMs: number;
}

/**
 * Lead orchestrator. Construct once per audit, call {@link run} with
 * the target source-tree root.
 */
export class LeadOrchestrator {
  private readonly parallelLimit: number;
  private readonly loadPrompts: () => Promise<Record<SpecialistAgentId, string>>;
  private readonly buildUserPrompt: (id: SpecialistAgentId, targetPath: string) => string;

  constructor(
    private readonly runtime: RuntimeAdapter,
    options: LeadOrchestratorOptions = {},
  ) {
    this.parallelLimit = options.parallelLimit ?? 5;
    this.loadPrompts = options.loadPrompts ?? loadAllSystemPrompts;
    this.buildUserPrompt = options.buildUserPrompt ?? defaultUserPrompt;
  }

  async run(targetPath: string): Promise<LeadAuditResult> {
    const started = Date.now();
    await this.runtime.initialize({ parallelLimit: this.parallelLimit });

    try {
      const prompts = await this.loadPrompts();
      const specs: AgentSpec[] = SPECIALIST_AGENT_IDS.map((id) => ({
        agentId: id,
        systemPrompt: prompts[id],
        userPrompt: this.buildUserPrompt(id, targetPath),
        tools: [
          { name: 'Read', description: 'Read a file' },
          { name: 'Grep', description: 'Search files with a regex' },
          { name: 'Glob', description: 'Find files by pattern' },
        ],
      }));

      const results = await mapWithConcurrency(specs, this.parallelLimit, (spec) =>
        this.runtime.runAgent(spec),
      );

      const allFindings = results.flatMap((r) => [...r.findings]);
      const findings = mergeFindings(allFindings);
      const { score, grade } = scoreAndGrade(findings);

      const agentErrors: AgentRuntimeError[] = results
        .filter((r) => r.errors.length > 0)
        .map((r) => ({ agentId: r.agentId, messages: [...r.errors] }));

      return {
        findings,
        score,
        grade,
        devReport: formatDevReport(findings),
        execSummary: formatExecSummary(findings),
        agentErrors,
        durationMs: Date.now() - started,
      };
    } finally {
      await this.runtime.shutdown();
    }
  }
}

function defaultUserPrompt(id: SpecialistAgentId, targetPath: string): string {
  return (
    `Audit the source tree at ${targetPath} for your WCAG 2.2 AA domain ` +
    `(${id}). Return a JSON array of findings in the format described ` +
    `in your system prompt.`
  );
}

/**
 * Merge findings with a stable (ruleId, file, line, url) key dedupe.
 *
 * No deep semantic dedupe - that lives in the Pro tier. The intent
 * here is to drop exact-key duplicates that come up when two
 * specialists flag the same defect (e.g. an unlabeled input may
 * appear in both forms-accessibility and aria-patterns).
 *
 * Last writer wins; agents are dispatched in fixed order, so the
 * outcome is deterministic across runs.
 */
export function mergeFindings(findings: readonly WcagFinding[]): WcagFinding[] {
  const byKey = new Map<string, WcagFinding>();
  for (const finding of findings) {
    byKey.set(keyOf(finding), finding);
  }
  return [...byKey.values()];
}

function keyOf(finding: WcagFinding): string {
  const loc = finding.location;
  const file = loc.file ? `${loc.file}:${loc.line ?? ''}` : '';
  const url = loc.url ?? '';
  return `${finding.ruleId}|${file}|${url}`;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}
