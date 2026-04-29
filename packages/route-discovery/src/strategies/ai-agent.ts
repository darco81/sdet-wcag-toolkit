/**
 * AI agent route-discovery strategy.
 *
 * Dispatches the `route-discovery-agent` (defined in
 * `.claude/agents/route-discovery-agent.md`) and parses its fenced-JSON
 * response into a `RouteDiscoveryResult`. The strategy itself is
 * runtime-agnostic - the actual Claude Code Task call is wired in by
 * the CLI through an injected `AiAgentInvoker`. Tests substitute a
 * recorded response.
 *
 * When no invoker is provided (default registry, no CC session), the
 * strategy returns empty + a warning explaining how to enable it.
 */

import type { DiscoveredRoute, RouteDiscoveryResult } from '@sdet-wcag-toolkit/core';

import type { RouteDiscoveryContext, RouteDiscoveryStrategyFn } from '../dispatcher.js';

/**
 * Contract for invoking the route-discovery agent. Inputs:
 *   - `prompt`: the task prompt the agent receives.
 *   - `rootDir`: the project root the agent will read from.
 *
 * Output: the agent's raw text reply, expected to end in a fenced
 * JSON block matching `RouteDiscoveryAgentPayload`.
 *
 * Failures (no CC session, agent error, network glitch) should throw
 * - the strategy catches and converts them into warnings.
 */
export type AiAgentInvoker = (input: {
  readonly prompt: string;
  readonly rootDir: string;
}) => Promise<string>;

export interface AiAgentStrategyOptions {
  /**
   * Wire the agent invoker. In production the CLI bridges this to the
   * Claude Code Task tool. Tests pass a recorded response. When
   * undefined, the strategy returns a "not enabled in this environment"
   * warning instead of throwing.
   */
  readonly invoker?: AiAgentInvoker;
  /**
   * Override the prompt template. Mostly useful in tests; production
   * uses the default template tuned for the route-discovery-agent
   * system prompt.
   */
  readonly promptTemplate?: (rootDir: string) => string;
}

/**
 * Shape the agent is expected to emit. Validated by `validatePayload`
 * on every parse - any deviation falls through to a parse warning.
 */
export interface RouteDiscoveryAgentPayload {
  readonly framework: string;
  readonly evidence?: string;
  readonly confidence?: number;
  readonly routes: ReadonlyArray<{
    readonly path: string;
    readonly source?: string;
    readonly isDynamic?: boolean;
    readonly sampleUrl?: string;
  }>;
  readonly warnings?: readonly string[];
}

const DYNAMIC_PATH_CHARS: readonly string[] = ['[', ']', ':', '*'];

const DEFAULT_PROMPT_TEMPLATE = (
  rootDir: string,
): string => `Discover the list of pages this project's WCAG audit should visit.

Project root: ${rootDir}

Steps:
1. Read package.json to identify the framework.
2. Glob the framework's routing files (src/pages, app/, pages/, src/routes, ...) and map them to URL paths.
3. For dynamic routes, resolve a representative sampleUrl when build-time enumeration is possible (getStaticPaths, generateStaticParams, content collections).
4. End your reply with a single fenced JSON block matching the RouteDiscoveryAgentPayload schema.`;

export function createAiAgentStrategy(
  options: AiAgentStrategyOptions = {},
): RouteDiscoveryStrategyFn {
  const promptTemplate = options.promptTemplate ?? DEFAULT_PROMPT_TEMPLATE;

  return async (context: RouteDiscoveryContext): Promise<RouteDiscoveryResult> => {
    if (!context.rootDir) {
      return emptyResult([
        'ai strategy requires a project rootDir (pass a path argument together with --strategy=ai)',
      ]);
    }

    if (!options.invoker) {
      return emptyResult([
        'ai strategy needs --use-ai inside a Claude Code session. ' +
          'Run via the /wcag:audit skill or pass --use-ai when calling the CLI from `claude` REPL.',
      ]);
    }

    const prompt = promptTemplate(context.rootDir);
    let raw: string;
    try {
      raw = await options.invoker({ prompt, rootDir: context.rootDir });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return emptyResult([`ai strategy: agent dispatch failed - ${message}`]);
    }

    const parsed = parseAiResponse(raw);
    if (parsed.kind === 'invalid') {
      return emptyResult([`ai strategy: ${parsed.reason}`]);
    }

    const routes = parsed.payload.routes
      .map((r) => normalizeRoute(r, parsed.payload.framework))
      .filter((r): r is DiscoveredRoute => r !== null);

    const warnings = [
      `ai strategy: detected ${parsed.payload.framework}${parsed.payload.evidence ? ` (${parsed.payload.evidence})` : ''}.`,
      ...(parsed.payload.warnings ?? []),
    ];

    return {
      strategy: 'ai',
      routes,
      confidence: deriveConfidence(parsed.payload, routes),
      warnings,
    };
  };
}

/**
 * Parse the agent's raw text into a validated payload. Returns a
 * tagged union so callers can branch on success vs. parse failure
 * without ever inspecting `null`/`undefined`.
 */
export function parseAiResponse(
  raw: string,
): { kind: 'ok'; payload: RouteDiscoveryAgentPayload } | { kind: 'invalid'; reason: string } {
  const cleaned = stripThinking(raw).trim();
  if (cleaned === '') {
    return { kind: 'invalid', reason: 'agent returned empty output' };
  }
  const jsonStr = extractJsonBlock(cleaned);
  let value: unknown;
  try {
    value = JSON.parse(jsonStr);
  } catch (e) {
    return {
      kind: 'invalid',
      reason: `agent JSON did not parse - ${(e as Error).message}`,
    };
  }
  return validatePayload(value);
}

function validatePayload(
  value: unknown,
): { kind: 'ok'; payload: RouteDiscoveryAgentPayload } | { kind: 'invalid'; reason: string } {
  if (!value || typeof value !== 'object') {
    return { kind: 'invalid', reason: 'agent JSON is not an object' };
  }
  const obj = value as Record<string, unknown>;
  if (typeof obj.framework !== 'string' || obj.framework === '') {
    return {
      kind: 'invalid',
      reason: 'agent JSON missing required string field "framework"',
    };
  }
  if (!Array.isArray(obj.routes)) {
    return {
      kind: 'invalid',
      reason: 'agent JSON missing required array field "routes"',
    };
  }

  const routes: Array<RouteDiscoveryAgentPayload['routes'][number]> = [];
  for (let i = 0; i < obj.routes.length; i++) {
    const entry = obj.routes[i];
    if (!entry || typeof entry !== 'object') {
      return { kind: 'invalid', reason: `routes[${i}] is not an object` };
    }
    const r = entry as Record<string, unknown>;
    if (typeof r.path !== 'string' || r.path === '') {
      return { kind: 'invalid', reason: `routes[${i}].path must be a non-empty string` };
    }
    routes.push({
      path: r.path,
      ...(typeof r.source === 'string' && { source: r.source }),
      ...(typeof r.isDynamic === 'boolean' && { isDynamic: r.isDynamic }),
      ...(typeof r.sampleUrl === 'string' && r.sampleUrl !== '' && { sampleUrl: r.sampleUrl }),
    });
  }

  const payload: RouteDiscoveryAgentPayload = {
    framework: obj.framework,
    routes,
    ...(typeof obj.evidence === 'string' && { evidence: obj.evidence }),
    ...(typeof obj.confidence === 'number' &&
      obj.confidence >= 0 &&
      obj.confidence <= 1 && { confidence: obj.confidence }),
    ...(Array.isArray(obj.warnings) && {
      warnings: obj.warnings.filter((w): w is string => typeof w === 'string'),
    }),
  };
  return { kind: 'ok', payload };
}

function normalizeRoute(
  entry: RouteDiscoveryAgentPayload['routes'][number],
  framework: string,
): DiscoveredRoute | null {
  if (entry.path === '') return null;
  const isDynamic = entry.isDynamic ?? hasDynamicSegment(entry.path);
  return {
    path: entry.path,
    source: entry.source ?? `route-discovery-agent (${framework})`,
    isDynamic,
    ...(entry.sampleUrl !== undefined && { sampleUrl: entry.sampleUrl }),
  };
}

function hasDynamicSegment(path: string): boolean {
  for (const ch of DYNAMIC_PATH_CHARS) {
    if (path.includes(ch)) return true;
  }
  return false;
}

/**
 * Confidence model:
 *   - empty routes      → 0
 *   - agent-supplied    → use it (clamped 0..1)
 *   - all dynamic w/o sampleUrl → cap at 0.5 (audit needs help)
 *   - mixed             → 0.85
 *   - all static        → 0.95 (AI is never quite as confident as router-scan)
 */
function deriveConfidence(
  payload: RouteDiscoveryAgentPayload,
  routes: readonly DiscoveredRoute[],
): number {
  if (routes.length === 0) return 0;
  if (typeof payload.confidence === 'number') {
    return Math.max(0, Math.min(1, payload.confidence));
  }
  const dynamic = routes.filter((r) => r.isDynamic).length;
  const dynamicWithoutSample = routes.filter(
    (r) => r.isDynamic && r.sampleUrl === undefined,
  ).length;
  if (dynamicWithoutSample === routes.length) return 0.5;
  if (dynamic === 0) return 0.95;
  return 0.85;
}

function stripThinking(raw: string): string {
  return raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

function extractJsonBlock(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/m.exec(text);
  if (fenced) return (fenced[1] ?? '').trim();
  const braceIndex = findFirstBraceOrBracket(text);
  if (braceIndex === -1) return text.trim();
  return text.slice(braceIndex).trim();
}

function findFirstBraceOrBracket(text: string): number {
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{' || ch === '[') return i;
  }
  return -1;
}

function emptyResult(warnings: readonly string[]): RouteDiscoveryResult {
  return {
    strategy: 'ai',
    routes: [],
    confidence: 0,
    warnings,
  };
}
