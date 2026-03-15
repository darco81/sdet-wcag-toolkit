/**
 * Thin DI wrapper around Claude Code's native `Task` tool.
 *
 * The CC runtime needs to call Task, but Task is a globally-injected
 * function only available inside a Claude Code session. Tests run
 * outside that environment, so we wrap it behind an interface and let
 * callers substitute a mock. In production the {@link defaultTaskInvoker}
 * looks up the global Task function at call time.
 */

export interface TaskInvocation {
  /** Must match `name` in a `.claude/agents/<name>.md` file. */
  readonly subagentType: string;
  /** Short description for logs / UX. */
  readonly description: string;
  /** The task prompt the subagent receives. */
  readonly prompt: string;
}

export interface TaskInvocationResult {
  /** Final text message returned by the subagent. */
  readonly text: string;
  /** Wall-clock milliseconds the subagent ran for. */
  readonly durationMs: number;
}

export type TaskInvoker = (input: TaskInvocation) => Promise<TaskInvocationResult>;

/**
 * Default invoker - calls the globally-injected `Task` function. Throws
 * outside a CC session; that's intentional, since this runtime is only
 * meaningful inside one. The CLI surfaces a friendly hint when the
 * caller is outside CC and asks for `--use-ai`.
 */
export const defaultTaskInvoker: TaskInvoker = async (input) => {
  const global = globalThis as { Task?: (arg: unknown) => Promise<unknown> };
  if (typeof global.Task !== 'function') {
    throw new Error(
      'Claude Code Task tool is not available in this runtime. ' +
        'AI specialists require a Claude Code session - run via the ' +
        '/wcag:audit skill, or omit --use-ai for static + dynamic only.',
    );
  }
  const start = Date.now();
  const raw = await global.Task({
    subagent_type: input.subagentType,
    description: input.description,
    prompt: input.prompt,
  });
  const durationMs = Date.now() - start;
  return { text: stringifyResult(raw), durationMs };
};

function stringifyResult(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && 'text' in raw) {
    const text = (raw as { text: unknown }).text;
    if (typeof text === 'string') return text;
  }
  return JSON.stringify(raw);
}
