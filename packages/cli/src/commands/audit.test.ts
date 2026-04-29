/**
 * Behavior tests for the `audit` command's argument plumbing - covers
 * the v0.3 `--use-ai` flag and the V0.4 `--multi-page` family. The full
 * audit pipeline is exercised in integration.test.ts; this file isolates
 * flag handling.
 */

import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';

import type { RouteDiscoveryResult } from '@sdet-wcag-toolkit/core';
import { createDefaultStrategyRegistry } from '@sdet-wcag-toolkit/route-discovery';

import { DEFAULT_MAX_PAGES, registerAuditCommand, resolveMaxPages, runAudit } from './audit.js';

function makeOptions(
  overrides: Partial<Parameters<typeof runAudit>[1]> = {},
): Parameters<typeof runAudit>[1] {
  return {
    json: false,
    top: '10',
    useAi: false,
    multiPage: false,
    dryRun: false,
    ...overrides,
  } as Parameters<typeof runAudit>[1];
}

describe('registerAuditCommand', () => {
  it('exposes --use-ai as a boolean flag (default false)', () => {
    const program = new Command();
    const cmd = registerAuditCommand(program);
    const options = cmd.options.map((o) => o.long);
    expect(options).toContain('--use-ai');
    const useAi = cmd.options.find((o) => o.long === '--use-ai');
    expect(useAi?.defaultValue).toBe(false);
  });

  it('keeps the v0.3 flags intact for backward compatibility', () => {
    const program = new Command();
    const cmd = registerAuditCommand(program);
    const longs = cmd.options.map((o) => o.long);
    expect(longs).toEqual(
      expect.arrayContaining(['--url', '--wait-for', '--json', '--top', '--use-ai']),
    );
  });

  it('exposes the V0.4 multi-page flag family', () => {
    const program = new Command();
    const cmd = registerAuditCommand(program);
    const longs = cmd.options.map((o) => o.long);
    expect(longs).toEqual(
      expect.arrayContaining([
        '--multi-page',
        '--strategy',
        '--max-pages',
        '--config',
        '--dry-run',
      ]),
    );
  });

  it('--multi-page defaults to false (strict backward compat)', () => {
    const program = new Command();
    const cmd = registerAuditCommand(program);
    const flag = cmd.options.find((o) => o.long === '--multi-page');
    expect(flag?.defaultValue).toBe(false);
  });

  it('audit help text mentions --use-ai and --multi-page', () => {
    const program = new Command();
    const cmd = registerAuditCommand(program);
    const help = cmd.helpInformation();
    expect(help).toContain('--use-ai');
    expect(help).toContain('--multi-page');
    expect(help).toMatch(/sitemap|router-scan|strategy/);
  });
});

describe('runAudit input validation', () => {
  it('refuses --use-ai without a path', async () => {
    await expect(runAudit(undefined, makeOptions({ useAi: true }))).rejects.toThrow(
      /AI agents require a source path/,
    );
  });

  it('still requires either path or url (in single-page mode)', async () => {
    await expect(runAudit(undefined, makeOptions())).rejects.toThrow(
      /Provide a path argument, a --url, or both/,
    );
  });

  it('rejects unknown --strategy values', async () => {
    await expect(
      runAudit(undefined, makeOptions({ multiPage: true, strategy: 'mystery' })),
    ).rejects.toThrow(/Unknown --strategy "mystery"/);
  });

  it('rejects --strategy outside of --multi-page mode', async () => {
    await expect(runAudit('.', makeOptions({ strategy: 'sitemap' }))).rejects.toThrow(
      /--strategy only applies in --multi-page mode/,
    );
  });

  it('rejects --dry-run outside of --multi-page mode', async () => {
    await expect(runAudit('.', makeOptions({ dryRun: true }))).rejects.toThrow(
      /--dry-run only applies in --multi-page mode/,
    );
  });

  it('accepts --multi-page with no path/url when --config is supplied', async () => {
    const registry = createDefaultStrategyRegistry({
      'json-config': async (): Promise<RouteDiscoveryResult> => ({
        strategy: 'json-config',
        routes: [{ path: '/', source: 'wcag.config.json', isDynamic: false }],
        confidence: 1,
        warnings: [],
      }),
    });
    await expect(
      runAudit(
        undefined,
        makeOptions({
          multiPage: true,
          strategy: 'json-config',
          config: 'wcag.config.json',
          dryRun: true,
          json: true,
        }),
        { strategyRegistry: registry },
      ),
    ).resolves.toBeUndefined();
  });
});

describe('runAudit multi-page dispatch', () => {
  /**
   * Vitest captures stdout itself, which makes `vi.spyOn(process.stdout, 'write')`
   * unreliable here - direct property replacement is the simplest way to record
   * what runAudit emits without fighting the runner.
   */
  async function captureStdout<T>(work: () => Promise<T>): Promise<{ value: T; writes: string[] }> {
    const writes: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: unknown): boolean => {
      writes.push(typeof chunk === 'string' ? chunk : String(chunk));
      return true;
    }) as typeof process.stdout.write;
    try {
      const value = await work();
      return { value, writes };
    } finally {
      process.stdout.write = original;
    }
  }

  it('emits the discovery payload when --dry-run + --json + --multi-page', async () => {
    const sitemap = vi.fn(
      async (): Promise<RouteDiscoveryResult> => ({
        strategy: 'sitemap',
        routes: [
          { path: '/about', source: 'sitemap.xml', isDynamic: false },
          { path: '/contact', source: 'sitemap.xml', isDynamic: false },
        ],
        confidence: 1,
        warnings: [],
      }),
    );
    const registry = createDefaultStrategyRegistry({ sitemap });
    const { writes } = await captureStdout(() =>
      runAudit(
        undefined,
        makeOptions({
          multiPage: true,
          strategy: 'sitemap',
          url: 'http://localhost:4321',
          dryRun: true,
          json: true,
        }),
        { strategyRegistry: registry },
      ),
    );
    expect(sitemap).toHaveBeenCalledOnce();
    const payload = JSON.parse(writes.join(''));
    expect(payload.strategy).toBe('sitemap');
    expect(payload.routes).toHaveLength(2);
  });

  it('passes --max-pages through to the dispatcher context (dry-run)', async () => {
    const captured: { maxPages?: number }[] = [];
    const sitemap = vi.fn(async (ctx): Promise<RouteDiscoveryResult> => {
      captured.push({ ...(ctx.maxPages !== undefined && { maxPages: ctx.maxPages }) });
      return {
        strategy: 'sitemap',
        routes: Array.from({ length: 5 }, (_, i) => ({
          path: `/p${i}`,
          source: 'sitemap.xml',
          isDynamic: false,
        })),
        confidence: 1,
        warnings: [],
      };
    });
    const registry = createDefaultStrategyRegistry({ sitemap });
    const { writes } = await captureStdout(() =>
      runAudit(
        undefined,
        makeOptions({
          multiPage: true,
          strategy: 'sitemap',
          url: 'http://localhost:4321',
          maxPages: '3',
          dryRun: true,
          json: true,
        }),
        { strategyRegistry: registry },
      ),
    );
    expect(captured[0]?.maxPages).toBe(3);
    const payload = JSON.parse(writes.join(''));
    expect(payload.routes).toHaveLength(3);
  });

  it('does not invoke the strategy registry when --multi-page is off (backward compat)', async () => {
    const sitemap = vi.fn();
    const registry = createDefaultStrategyRegistry({
      sitemap: sitemap as Parameters<typeof createDefaultStrategyRegistry>[0]['sitemap'],
    });
    // Will fail validation (no path/url) but the failure must occur
    // before the strategy registry is consulted.
    await expect(
      runAudit(undefined, makeOptions(), { strategyRegistry: registry }),
    ).rejects.toThrow();
    expect(sitemap).not.toHaveBeenCalled();
  });

  it('throws a clear error when --multi-page runs without --url or wcag.config.json baseUrl', async () => {
    const sitemap = vi.fn(
      async (): Promise<RouteDiscoveryResult> => ({
        strategy: 'sitemap',
        routes: [{ path: '/about', source: 'sitemap.xml', isDynamic: false }],
        confidence: 1,
        warnings: [],
      }),
    );
    const registry = createDefaultStrategyRegistry({ sitemap });
    await expect(
      runAudit('.', makeOptions({ multiPage: true, strategy: 'sitemap' }), {
        strategyRegistry: registry,
      }),
    ).rejects.toThrow(/--multi-page audit needs a base URL/);
  });

  it('runs the multi-page orchestrator and emits a JSON report when discovery is empty (no browser launch)', async () => {
    // An empty route list short-circuits the orchestrator before it
    // touches Playwright, so this test exercises the wiring without
    // needing a real browser.
    const sitemap = vi.fn(
      async (): Promise<RouteDiscoveryResult> => ({
        strategy: 'sitemap',
        routes: [],
        confidence: 0,
        warnings: ['no routes'],
      }),
    );
    const registry = createDefaultStrategyRegistry({ sitemap });
    const { writes } = await captureStdout(() =>
      runAudit(
        undefined,
        makeOptions({
          multiPage: true,
          strategy: 'sitemap',
          url: 'http://localhost:4321',
          json: true,
        }),
        { strategyRegistry: registry },
      ),
    );
    const report = JSON.parse(writes.join(''));
    expect(report.baseUrl).toBe('http://localhost:4321');
    expect(report.summary).toEqual({
      pagesAudited: 0,
      pagesSkipped: 0,
      totalFindings: 0,
      uniqueFindings: 0,
    });
    expect(report.discovery.strategy).toBe('sitemap');
  });
});

describe('runAudit AI strategy wiring', () => {
  async function captureStdout<T>(work: () => Promise<T>): Promise<{ writes: string[] }> {
    const writes: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: unknown): boolean => {
      writes.push(typeof chunk === 'string' ? chunk : String(chunk));
      return true;
    }) as typeof process.stdout.write;
    try {
      await work();
      return { writes };
    } finally {
      process.stdout.write = original;
    }
  }

  it('rejects --strategy=ai without a path arg', async () => {
    await expect(
      runAudit(undefined, makeOptions({ multiPage: true, strategy: 'ai' })),
    ).rejects.toThrow(/--strategy=ai requires a source path/);
  });

  it('dispatches the route-discovery-agent through the injected TaskInvoker', async () => {
    const taskInvoker = vi.fn(async () => ({
      text: '```json\n{ "framework": "astro", "routes": [{"path": "/", "isDynamic": false}] }\n```',
      durationMs: 10,
    }));

    const { writes } = await captureStdout(() =>
      runAudit(
        '.',
        makeOptions({
          multiPage: true,
          strategy: 'ai',
          dryRun: true,
          json: true,
        }),
        { taskInvoker },
      ),
    );

    expect(taskInvoker).toHaveBeenCalledOnce();
    const call = taskInvoker.mock.calls[0]?.[0];
    expect(call?.subagentType).toBe('route-discovery-agent');
    expect(call?.prompt).toContain('Project root:');

    const payload = JSON.parse(writes.join(''));
    expect(payload.strategy).toBe('ai');
    expect(payload.routes).toHaveLength(1);
  });

  it('does NOT wire the TaskInvoker when --use-ai is off (default registry behavior)', async () => {
    const taskInvoker = vi.fn();

    await captureStdout(() =>
      runAudit(
        '.',
        makeOptions({
          multiPage: true,
          strategy: 'sitemap', // not ai → invoker stays unused
          url: 'http://localhost:9999',
          dryRun: true,
          json: true,
        }),
        { taskInvoker: taskInvoker as unknown as Parameters<typeof runAudit>[2]['taskInvoker'] },
      ),
    );

    expect(taskInvoker).not.toHaveBeenCalled();
  });

  it('--use-ai together with --multi-page wires the AI strategy into the auto-fallback chain', async () => {
    // sitemap will fail (unreachable URL), router-scan will fail (no
    // framework in cwd), so the chain falls through to ai which is now
    // wired. The registry override path skips the live network/fs work.
    const taskInvoker = vi.fn(async () => ({
      text: '```json\n{ "framework": "next", "routes": [{"path": "/", "isDynamic": false}] }\n```',
      durationMs: 5,
    }));

    await captureStdout(() =>
      runAudit(
        '.',
        makeOptions({
          multiPage: true,
          useAi: true,
          strategy: 'ai', // pin to ai so we don't depend on chain order
          dryRun: true,
          json: true,
        }),
        { taskInvoker },
      ),
    );

    expect(taskInvoker).toHaveBeenCalledOnce();
  });
});

describe('resolveMaxPages', () => {
  it('returns the default when the flag is absent', () => {
    expect(resolveMaxPages(undefined)).toBe(DEFAULT_MAX_PAGES);
  });

  it('parses explicit values', () => {
    expect(resolveMaxPages('10')).toBe(10);
    expect(resolveMaxPages('0')).toBe(0); // 0 = no limit
  });

  it('rejects non-numeric or negative input', () => {
    expect(() => resolveMaxPages('abc')).toThrow(/Invalid --max-pages/);
    expect(() => resolveMaxPages('-5')).toThrow(/Invalid --max-pages/);
  });
});
