/**
 * HardGuard - tool sanitization for audit agents.
 *
 * Audit agents (semantic-structure, aria, keyboard, contrast, forms)
 * only need to READ source and SEARCH for patterns. They never need
 * shell, web fetch, or write. Giving them those tools would be a
 * needless blast-radius increase: a prompt-injected page or a
 * hallucinated "fix-it" refactor could escape the audit boundary.
 *
 * Pattern: keep an allowlist + denylist and run tool lists through
 * the guard BEFORE sending to the LLM. Cheaper and more reliable
 * than asking the model to "please don't call bash".
 */

import type { ToolDefinition } from './types.js';

/** Tools audit agents may use. Kept intentionally small. */
export const ALLOWED_AUDIT_TOOLS: ReadonlySet<string> = new Set(['Read', 'Grep', 'Glob', 'LS']);

/** Tools explicitly banned from audit agents. Always wins over allowlist. */
export const DENIED_AUDIT_TOOLS: ReadonlySet<string> = new Set([
  'Bash',
  'Exec',
  'Shell',
  'WebFetch',
  'WebSearch',
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit',
]);

export interface SanitizeOptions {
  /** If true, throws when a denied tool is present. Default: filter silently. */
  readonly strict?: boolean;
}

/**
 * Drop denied tools and keep only allowlisted ones. Preserves order.
 *
 * Throws in strict mode when a denied tool is detected - useful in
 * tests to catch regressions where a developer accidentally hands
 * Bash to an audit agent.
 */
export function sanitizeAgentTools(
  tools: readonly ToolDefinition[],
  options: SanitizeOptions = {},
): ToolDefinition[] {
  const result: ToolDefinition[] = [];
  for (const tool of tools) {
    if (DENIED_AUDIT_TOOLS.has(tool.name)) {
      if (options.strict) {
        throw new Error(
          `HardGuard: tool "${tool.name}" is denied for audit agents. ` +
            `Audit agents must be read-only. Review the caller.`,
        );
      }
      continue;
    }
    if (!ALLOWED_AUDIT_TOOLS.has(tool.name)) {
      continue;
    }
    result.push(tool);
  }
  return result;
}

/** Predicate form - useful for assertions in tests. */
export function isDeniedTool(name: string): boolean {
  return DENIED_AUDIT_TOOLS.has(name);
}

/** Predicate form - useful for assertions in tests. */
export function isAllowedAuditTool(name: string): boolean {
  return ALLOWED_AUDIT_TOOLS.has(name);
}
