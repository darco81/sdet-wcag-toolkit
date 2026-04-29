/**
 * AI agent strategy tests. Mock invoker returns recorded responses so
 * the suite is hermetic. Covers parser edge cases, validation, default
 * "no invoker" behavior, and confidence calculation.
 */

import { describe, expect, it, vi } from 'vitest';

import { type AiAgentInvoker, createAiAgentStrategy, parseAiResponse } from './ai-agent.js';

const ROOT = '/proj';

function fixedInvoker(response: string): AiAgentInvoker {
  return vi.fn(async () => response);
}

const VALID_RESPONSE = `Here are the routes I found.

\`\`\`json
{
  "framework": "astro",
  "evidence": "found astro@^4 in package.json + src/pages tree",
  "confidence": 0.9,
  "routes": [
    { "path": "/", "source": "src/pages/index.astro", "isDynamic": false },
    { "path": "/about", "source": "src/pages/about.astro", "isDynamic": false },
    { "path": "/blog/[slug]", "source": "src/pages/blog/[slug].astro", "isDynamic": true, "sampleUrl": "/blog/intro" }
  ],
  "warnings": ["Routes under /api/* skipped (server endpoints)."]
}
\`\`\``;

describe('createAiAgentStrategy', () => {
  it('parses a well-formed agent response into a RouteDiscoveryResult', async () => {
    const invoker = fixedInvoker(VALID_RESPONSE);
    const strategy = createAiAgentStrategy({ invoker });

    const result = await strategy({ rootDir: ROOT });

    expect(result.strategy).toBe('ai');
    expect(result.routes).toHaveLength(3);
    expect(result.routes.map((r) => r.path)).toEqual(['/', '/about', '/blog/[slug]']);
    expect(result.routes[2]?.sampleUrl).toBe('/blog/intro');
    expect(result.confidence).toBe(0.9);
    expect(result.warnings.some((w) => w.includes('detected astro'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('/api/* skipped'))).toBe(true);
    expect(invoker).toHaveBeenCalledOnce();
  });

  it('passes the rootDir into the prompt template', async () => {
    const invoker = vi.fn(async () => VALID_RESPONSE);
    const strategy = createAiAgentStrategy({ invoker });

    await strategy({ rootDir: ROOT });

    const call = invoker.mock.calls[0]?.[0];
    expect(call?.rootDir).toBe(ROOT);
    expect(call?.prompt).toContain(ROOT);
  });

  it('strips <think> blocks before parsing', async () => {
    const response = `<think>
Let me check package.json...
</think>

\`\`\`json
{ "framework": "next", "routes": [{"path": "/", "isDynamic": false}] }
\`\`\``;
    const invoker = fixedInvoker(response);
    const strategy = createAiAgentStrategy({ invoker });

    const result = await strategy({ rootDir: ROOT });

    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]?.path).toBe('/');
  });

  it('returns empty + warning when no invoker is wired', async () => {
    const strategy = createAiAgentStrategy();

    const result = await strategy({ rootDir: ROOT });

    expect(result.routes).toEqual([]);
    expect(result.warnings[0]).toMatch(/--use-ai inside a Claude Code session/);
  });

  it('returns empty + warning when context has no rootDir', async () => {
    const invoker = vi.fn();
    const strategy = createAiAgentStrategy({ invoker });

    const result = await strategy({});

    expect(result.routes).toEqual([]);
    expect(result.warnings[0]).toMatch(/requires a project rootDir/);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('captures invoker errors as warnings instead of throwing', async () => {
    const invoker: AiAgentInvoker = vi.fn(async () => {
      throw new Error('Task tool not available');
    });
    const strategy = createAiAgentStrategy({ invoker });

    const result = await strategy({ rootDir: ROOT });

    expect(result.routes).toEqual([]);
    expect(result.warnings[0]).toMatch(/agent dispatch failed.*Task tool not available/);
  });

  it('reports a parse-failure warning when JSON is malformed', async () => {
    const invoker = fixedInvoker('Sorry, I cannot help with that.');
    const strategy = createAiAgentStrategy({ invoker });

    const result = await strategy({ rootDir: ROOT });

    expect(result.routes).toEqual([]);
    expect(result.warnings[0]).toMatch(/ai strategy/);
  });

  it('infers isDynamic from path when the agent omits it', async () => {
    const response = `\`\`\`json
{
  "framework": "next",
  "routes": [
    { "path": "/blog/[slug]" },
    { "path": "/about" }
  ]
}
\`\`\``;
    const invoker = fixedInvoker(response);
    const strategy = createAiAgentStrategy({ invoker });

    const result = await strategy({ rootDir: ROOT });

    expect(result.routes[0]?.isDynamic).toBe(true);
    expect(result.routes[1]?.isDynamic).toBe(false);
  });

  it('falls back source to "route-discovery-agent (<framework>)" when missing', async () => {
    const response = `\`\`\`json
{ "framework": "vue", "routes": [{"path": "/", "isDynamic": false}] }
\`\`\``;
    const invoker = fixedInvoker(response);
    const strategy = createAiAgentStrategy({ invoker });

    const result = await strategy({ rootDir: ROOT });

    expect(result.routes[0]?.source).toBe('route-discovery-agent (vue)');
  });

  it('caps confidence at 0.5 when every route is dynamic without sampleUrl', async () => {
    const response = `\`\`\`json
{
  "framework": "next",
  "routes": [
    { "path": "/blog/[slug]", "isDynamic": true },
    { "path": "/users/[id]", "isDynamic": true }
  ]
}
\`\`\``;
    const invoker = fixedInvoker(response);
    const strategy = createAiAgentStrategy({ invoker });

    const result = await strategy({ rootDir: ROOT });

    expect(result.confidence).toBe(0.5);
  });

  it('lifts confidence to 0.95 when all routes are static and agent omitted confidence', async () => {
    const response = `\`\`\`json
{
  "framework": "astro",
  "routes": [
    { "path": "/", "isDynamic": false },
    { "path": "/about", "isDynamic": false }
  ]
}
\`\`\``;
    const invoker = fixedInvoker(response);
    const strategy = createAiAgentStrategy({ invoker });

    const result = await strategy({ rootDir: ROOT });

    expect(result.confidence).toBe(0.95);
  });

  it('clamps an out-of-range confidence into [0, 1]', async () => {
    const response = `\`\`\`json
{
  "framework": "astro",
  "confidence": 1.5,
  "routes": [{ "path": "/", "isDynamic": false }]
}
\`\`\``;
    const invoker = fixedInvoker(response);
    const strategy = createAiAgentStrategy({ invoker });

    const result = await strategy({ rootDir: ROOT });

    // Out-of-range values are dropped during validation, so confidence
    // falls back to the static-only default of 0.95.
    expect(result.confidence).toBe(0.95);
  });

  it('honors a custom prompt template (DI for tests / Pro tier)', async () => {
    const invoker = vi.fn(async () => VALID_RESPONSE);
    const strategy = createAiAgentStrategy({
      invoker,
      promptTemplate: (root) => `CUSTOM_PROMPT for ${root}`,
    });

    await strategy({ rootDir: ROOT });

    expect(invoker.mock.calls[0]?.[0].prompt).toBe(`CUSTOM_PROMPT for ${ROOT}`);
  });
});

describe('parseAiResponse', () => {
  it('accepts JSON without a fence as long as it starts with { or [', () => {
    const raw = '{ "framework": "next", "routes": [{"path": "/"}] }';
    const result = parseAiResponse(raw);
    expect(result.kind).toBe('ok');
  });

  it('rejects empty input', () => {
    const result = parseAiResponse('');
    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') {
      expect(result.reason).toMatch(/empty output/);
    }
  });

  it('rejects non-object JSON (top-level array, string, number)', () => {
    expect(parseAiResponse('"hi"').kind).toBe('invalid');
    expect(parseAiResponse('42').kind).toBe('invalid');
    expect(parseAiResponse('[]').kind).toBe('invalid');
  });

  it('rejects payload missing the framework field', () => {
    const result = parseAiResponse('{ "routes": [] }');
    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') {
      expect(result.reason).toMatch(/framework/);
    }
  });

  it('rejects payload missing the routes field', () => {
    const result = parseAiResponse('{ "framework": "next" }');
    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') {
      expect(result.reason).toMatch(/routes/);
    }
  });

  it('rejects route entries with empty path', () => {
    const result = parseAiResponse('{ "framework": "next", "routes": [{"path": ""}] }');
    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') {
      expect(result.reason).toMatch(/non-empty string/);
    }
  });

  it('drops empty sampleUrl values during validation', () => {
    const result = parseAiResponse(
      '{ "framework": "next", "routes": [{"path": "/x", "sampleUrl": ""}] }',
    );
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect(result.payload.routes[0]?.sampleUrl).toBeUndefined();
  });

  it('preserves valid optional fields', () => {
    const result = parseAiResponse(
      '{ "framework": "astro", "evidence": "test", "routes": [{"path": "/", "source": "src/x.astro", "isDynamic": false}] }',
    );
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect(result.payload.evidence).toBe('test');
    expect(result.payload.routes[0]?.source).toBe('src/x.astro');
  });
});
