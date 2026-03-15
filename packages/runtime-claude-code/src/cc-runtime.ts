/**
 * Claude Code runtime adapter.
 *
 * Uses CC's native `Task` tool (not a subprocess). When we're already
 * inside a CC session, spawning another `claude` process would be
 * silly. Task delegates work to a named subagent and streams the
 * result back.
 *
 * Precondition: `.claude/agents/<agentId>.md` must exist in the target
 * repo. The `wcag-toolkit init` command (or the `/wcag:audit` skill)
 * provisions those files.
 */

import type { WcagFinding } from '@sdet-wcag-toolkit/core';
import {
  parseAgentOutput,
  sanitizeAgentTools,
  type AgentResult,
  type AgentSpec,
  type RuntimeAdapter,
  type RuntimeOptions,
} from '@sdet-wcag-toolkit/runtime-core';

import { defaultTaskInvoker, type TaskInvoker } from './task-tool-wrapper.js';

export interface ClaudeCodeRuntimeOptions {
  /** Replace the Task invoker - primarily for tests. */
  readonly taskInvoker?: TaskInvoker;
}

export class ClaudeCodeRuntime implements RuntimeAdapter {
  readonly id = 'claude-code' as const;
  readonly name = 'Claude Code (native Task tool)';

  private readonly taskInvoker: TaskInvoker;

  constructor(options: ClaudeCodeRuntimeOptions = {}) {
    this.taskInvoker = options.taskInvoker ?? defaultTaskInvoker;
  }

  async initialize(_options: RuntimeOptions): Promise<void> {
    // No-op. The Task tool is available as long as we're inside CC.
  }

  async runAgent(spec: AgentSpec): Promise<AgentResult> {
    // HardGuard sanitizes the tool list before the spec reaches Task.
    // Task itself ignores the tool parameter (subagent .md files own
    // their own `allowed_tools`), but we still sanitize so callers
    // cannot accidentally hand Bash to an audit agent.
    sanitizeAgentTools(spec.tools, { strict: true });

    const started = Date.now();
    try {
      const invocation = await this.taskInvoker({
        subagentType: spec.agentId,
        description: `WCAG audit: ${spec.agentId}`,
        prompt: spec.userPrompt,
      });

      const findings = safeParseOutput(invocation.text, spec.agentId);
      return {
        agentId: spec.agentId,
        findings: findings.value,
        rawOutput: invocation.text,
        toolCalls: [],
        durationMs: invocation.durationMs,
        errors: findings.errors,
      };
    } catch (error) {
      return {
        agentId: spec.agentId,
        findings: [],
        rawOutput: '',
        toolCalls: [],
        durationMs: Date.now() - started,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  async shutdown(): Promise<void> {
    // No-op. Nothing to clean up - we don't own any subprocess.
  }
}

function safeParseOutput(
  text: string,
  agentId: string,
): { value: WcagFinding[]; errors: string[] } {
  try {
    return { value: parseAgentOutput(text, agentId), errors: [] };
  } catch (error) {
    return {
      value: [],
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
