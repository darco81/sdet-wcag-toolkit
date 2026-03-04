/**
 * Runtime adapter contract.
 *
 * The orchestrator talks to one interface; concrete runtimes (Claude
 * Code via Task tool, future API runtimes) implement
 * {@link RuntimeAdapter}. Per-runtime quirks (tool-calling APIs,
 * thinking tokens, streaming) are hidden inside the adapter.
 *
 * Public toolkit ships with {@link RuntimeId} = `'claude-code'` only;
 * the broader Pro tier adds OpenCode and OpenCode-Ollama runtimes.
 *
 * Findings are returned in the shared `WcagFinding` shape from
 * `@sdet-wcag-toolkit/core`. The adapter layer owns the parse step;
 * callers never see raw LLM output.
 */

import type { WcagFinding } from '@sdet-wcag-toolkit/core';

/** Canonical runtime identifier. Public toolkit supports CC only. */
export type RuntimeId = 'claude-code';

/** A read-only tool the runtime exposes to the agent.
 *
 *  Audit agents only need read/search tools - never anything that
 *  mutates the source tree. {@link sanitizeAgentTools} enforces this
 *  before the spec reaches the runtime. */
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema?: Record<string, unknown>;
}

/** Audit-trail record of a single tool invocation. */
export interface ToolCall {
  readonly tool: string;
  readonly input: unknown;
  readonly output?: unknown;
  readonly durationMs?: number;
  readonly error?: string;
}

/** Everything a runtime needs to run one agent once. */
export interface AgentSpec {
  /** Stable identifier, matches the prompt filename in `runtime-core/src/prompts/`. */
  readonly agentId: string;
  /** System prompt (role, rules, output format). Shared across runtimes. */
  readonly systemPrompt: string;
  /** Task-specific prompt - e.g. "audit this directory". */
  readonly userPrompt: string;
  /** Tools the agent may call. Pass unfiltered; the runtime calls
   *  {@link sanitizeAgentTools} internally. */
  readonly tools: readonly ToolDefinition[];
  /** Upper bound on output tokens, when the runtime supports it. */
  readonly maxTokens?: number;
  /** Milliseconds before the runtime should abort. */
  readonly timeoutMs?: number;
}

/** Result of one agent invocation. Always populated; errors go in `errors`. */
export interface AgentResult {
  readonly agentId: string;
  /** Parsed + schema-validated findings. Empty array if agent was clean. */
  readonly findings: readonly WcagFinding[];
  /** Verbatim LLM output, post-thinking-tag stripping. */
  readonly rawOutput: string;
  /** All tool calls the agent made - useful for debug reports. */
  readonly toolCalls: readonly ToolCall[];
  /** Tokens burned, when the runtime can report it. */
  readonly tokensUsed?: number;
  readonly durationMs: number;
  /** Non-fatal error messages. Fatal errors throw instead. */
  readonly errors: readonly string[];
}

/** Runtime-specific configuration. Runtimes ignore fields they don't use. */
export interface RuntimeOptions {
  /** Maximum agents running in parallel (orchestrator-level). */
  readonly parallelLimit?: number;
  /** Default per-agent timeout in ms if the spec doesn't override. */
  readonly defaultTimeoutMs?: number;
}

/** The contract every runtime implements. */
export interface RuntimeAdapter {
  readonly id: RuntimeId;
  readonly name: string;
  /** Verify availability / spawn subprocess. Idempotent. */
  initialize(options: RuntimeOptions): Promise<void>;
  /** Run one agent end-to-end. Returns `AgentResult` with `errors`
   *  populated for agent-level failures; throws only on runtime-level
   *  failures (subprocess dead, etc.). */
  runAgent(spec: AgentSpec): Promise<AgentResult>;
  /** Cleanup. Idempotent. */
  shutdown(): Promise<void>;
}
