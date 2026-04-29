/**
 * `audit` command. Modes:
 *   - Static only:    `wcag-toolkit audit ./src`
 *   - Dynamic only:   `wcag-toolkit audit --url https://example.com`
 *   - Static+dynamic: `wcag-toolkit audit ./src --url https://example.com`
 *   - + AI agents:    add `--use-ai` to dispatch the 5 specialist
 *                     agents through Claude Code's Task tool. Requires
 *                     a CC session (run via /wcag:audit skill or from
 *                     inside `claude` REPL).
 *   - Multi-page:     add `--multi-page` to discover and audit a list of
 *                     pages instead of just `--url`. Strategy auto-falls
 *                     back through sitemap → router-scan → json-config.
 *                     Pin a strategy with `--strategy=<name>`.
 *                     Phase 1 ships the discovery wiring; the actual
 *                     per-page audit loop arrives in Phase 6.
 *
 * `--use-ai` and `--multi-page` are both opt-in to preserve v0.3 CI
 * behavior - running without either flag is a byte-for-byte v0.3 audit.
 */

import { resolve } from 'node:path';

import chalk from 'chalk';
import { Command } from 'commander';

import type {
  RouteDiscoveryResult,
  RouteDiscoveryStrategy,
  WcagFinding,
} from '@sdet-wcag-toolkit/core';
import { createDefaultDynamicOrchestrator } from '@sdet-wcag-toolkit/dynamic-tester';
import { LeadOrchestrator } from '@sdet-wcag-toolkit/orchestrator';
import {
  type AiAgentInvoker,
  createAiAgentStrategy,
  createDefaultStrategyRegistry,
  dispatchRouteDiscovery,
  type RouteDiscoveryContext,
  type StrategyRegistry,
} from '@sdet-wcag-toolkit/route-discovery';
import {
  ClaudeCodeRuntime,
  defaultTaskInvoker,
  type TaskInvoker,
} from '@sdet-wcag-toolkit/runtime-claude-code';
import { createDefaultOrchestrator, loadSources } from '@sdet-wcag-toolkit/static-analyzer';

import { formatConsoleReport } from '../reporters/console.js';

const VALID_STRATEGIES: readonly RouteDiscoveryStrategy[] = [
  'ai',
  'sitemap',
  'router-scan',
  'json-config',
];

/** Default cap for multi-page audits. Override with --max-pages or set 0 for no limit. */
export const DEFAULT_MAX_PAGES = 50;

export interface AuditOptions {
  readonly url?: string;
  readonly json: boolean;
  readonly top: string;
  readonly waitFor?: string;
  readonly useAi: boolean;
  /** Enable multi-page discovery + audit. Backward-compat: false = v0.3 behavior. */
  readonly multiPage: boolean;
  /** Pin a single discovery strategy. Defaults to auto-fallback chain. */
  readonly strategy?: string;
  /** Hard cap on pages audited. String form to match commander parsing. */
  readonly maxPages?: string;
  /** Path to wcag.config.json (Strategy 4). */
  readonly config?: string;
  /** List discovered URLs without running the actual audit. */
  readonly dryRun: boolean;
}

/** Internal seam - tests inject a mock registry to avoid hitting real strategies. */
export interface RunAuditDeps {
  readonly strategyRegistry?: StrategyRegistry;
  /**
   * Override the Task invoker used by the AI strategy. Tests pass a
   * recorded response; production wires the default Claude Code Task
   * tool wrapper.
   */
  readonly taskInvoker?: TaskInvoker;
}

export function registerAuditCommand(program: Command): Command {
  return program
    .command('audit')
    .description('Run a WCAG 2.2 AA audit against a directory, a URL, or both')
    .argument('[path]', 'Directory to analyze (static path). Omit for URL-only audits.')
    .option('--url <url>', 'URL to audit dynamically with Playwright + axe-core')
    .option('--wait-for <selector>', 'Wait for this CSS selector before running the dynamic audit')
    .option('--json', 'Emit findings as JSON to stdout', false)
    .option('--top <n>', 'How many top-priority findings to show in console output', '10')
    .option(
      '--use-ai',
      'Dispatch the 5 WCAG specialist agents through Claude Code (requires a CC session)',
      false,
    )
    .option(
      '--multi-page',
      'Discover and audit multiple pages instead of just --url. Falls back through sitemap → router-scan → json-config.',
      false,
    )
    .option(
      '--strategy <name>',
      'Pin a discovery strategy: ai | sitemap | router-scan | json-config',
    )
    .option(
      '--max-pages <n>',
      `Maximum pages to audit in --multi-page mode (default ${DEFAULT_MAX_PAGES}, 0 = no limit)`,
    )
    .option('--config <path>', 'Path to wcag.config.json (used by the json-config strategy)')
    .option(
      '--dry-run',
      'List the URLs --multi-page would audit and exit (no actual audit run)',
      false,
    )
    .action(async (pathArg: string | undefined, options: AuditOptions) => {
      await runAudit(pathArg, options);
    });
}

export async function runAudit(
  pathArg: string | undefined,
  options: AuditOptions,
  deps: RunAuditDeps = {},
): Promise<void> {
  if (options.useAi && !pathArg) {
    throw new Error('AI agents require a source path. Pass a directory along with --use-ai.');
  }

  if (!pathArg && !options.url && !options.multiPage && !options.config) {
    throw new Error('Provide a path argument, a --url, or both.');
  }

  if (options.strategy !== undefined && !isValidStrategy(options.strategy)) {
    throw new Error(
      `Unknown --strategy "${options.strategy}". Expected one of: ${VALID_STRATEGIES.join(', ')}.`,
    );
  }

  if (!options.multiPage && options.strategy !== undefined) {
    throw new Error('--strategy only applies in --multi-page mode.');
  }

  if (!options.multiPage && options.dryRun) {
    throw new Error('--dry-run only applies in --multi-page mode.');
  }

  if (options.multiPage && options.strategy === 'ai' && !pathArg) {
    throw new Error('--strategy=ai requires a source path so the agent can read the project.');
  }

  // Multi-page path is currently a discovery preview. Audit loop ships in Phase 6.
  if (options.multiPage) {
    const discovery = await discoverRoutes(pathArg, options, deps);

    if (options.dryRun || options.json) {
      const payload = {
        strategy: discovery.strategy,
        confidence: discovery.confidence,
        warnings: discovery.warnings,
        routes: discovery.routes,
      };
      if (options.json) {
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      } else {
        renderDryRun(discovery);
      }
      return;
    }

    // Phase 6 will replace this with the multi-page orchestrator. Until
    // then we stop after discovery to avoid silently regressing v0.3
    // single-page behavior.
    renderDryRun(discovery);
    console.log(
      chalk.dim(
        '\n(Multi-page audit loop lands in V0.4 Phase 6. Phase 1 ships discovery + dispatcher.)',
      ),
    );
    return;
  }

  const findings: WcagFinding[] = [];

  if (pathArg) {
    const rootDir = resolve(process.cwd(), pathArg);
    const context = await loadSources({ rootDir });
    const staticFindings = createDefaultOrchestrator().run(context);
    findings.push(...staticFindings);

    if (options.useAi) {
      try {
        const lead = new LeadOrchestrator(new ClaudeCodeRuntime());
        const aiResult = await lead.run(rootDir);
        findings.push(...aiResult.findings);
        if (aiResult.agentErrors.length > 0 && !options.json) {
          for (const err of aiResult.agentErrors) {
            console.error(
              chalk.yellow(
                `! agent ${err.agentId} returned ${err.messages.length} error(s); findings from other agents kept.`,
              ),
            );
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `--use-ai failed: ${message}\n` +
            'AI specialists require a Claude Code session. Run via the ' +
            '/wcag:audit skill, or omit --use-ai for static + dynamic only.',
        );
      }
    }
  }

  if (options.url) {
    const dynamic = createDefaultDynamicOrchestrator();
    const dynamicFindings = await dynamic.run({
      url: options.url,
      ...(options.waitFor !== undefined && { waitForSelector: options.waitFor }),
    });
    findings.push(...dynamicFindings);
  }

  const deduped = dedupeById(findings);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(deduped, null, 2)}\n`);
    return;
  }

  const top = Number.parseInt(options.top, 10);
  const report = formatConsoleReport(deduped, { top: Number.isFinite(top) ? top : 10 });
  console.log(report);

  if (deduped.some((f) => f.severity === 'critical' || f.severity === 'serious')) {
    process.exitCode = 1;
  } else if (!pathArg && options.url) {
    console.log(chalk.dim('\n(Dynamic audit complete.)'));
  }
}

/**
 * Resolve `--max-pages` from CLI string form to a numeric cap. Returns
 * `DEFAULT_MAX_PAGES` when the flag is absent, the explicit value when
 * present, and rejects negatives or non-numeric strings.
 */
export function resolveMaxPages(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_MAX_PAGES;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid --max-pages "${raw}". Expected a non-negative integer.`);
  }
  return parsed;
}

function isValidStrategy(value: string): value is RouteDiscoveryStrategy {
  return (VALID_STRATEGIES as readonly string[]).includes(value);
}

async function discoverRoutes(
  pathArg: string | undefined,
  options: AuditOptions,
  deps: RunAuditDeps,
): Promise<RouteDiscoveryResult> {
  const context: RouteDiscoveryContext = {
    ...(pathArg !== undefined && { rootDir: resolve(process.cwd(), pathArg) }),
    ...(options.url !== undefined && { baseUrl: options.url }),
    ...(options.config !== undefined && {
      configPath: resolve(process.cwd(), options.config),
    }),
    maxPages: resolveMaxPages(options.maxPages),
  };

  const registry = deps.strategyRegistry ?? buildRegistry(options, deps);

  return dispatchRouteDiscovery(context, registry, {
    ...(options.strategy !== undefined && {
      strategy: options.strategy as RouteDiscoveryStrategy,
    }),
  });
}

/**
 * Build the default registry, wiring the Claude Code Task tool into
 * the AI strategy when the user opted in (`--use-ai` or
 * `--strategy=ai`). Without that opt-in, the AI strategy stays in its
 * "no invoker" mode and emits a helpful warning instead of dispatching.
 */
function buildRegistry(options: AuditOptions, deps: RunAuditDeps): StrategyRegistry {
  const aiEnabled = options.useAi || options.strategy === 'ai';
  if (!aiEnabled) {
    return createDefaultStrategyRegistry();
  }
  const taskInvoker = deps.taskInvoker ?? defaultTaskInvoker;
  const aiInvoker = wrapTaskInvokerForRouteDiscovery(taskInvoker);
  return createDefaultStrategyRegistry({
    ai: createAiAgentStrategy({ invoker: aiInvoker }),
  });
}

/**
 * Bridge a Claude Code TaskInvoker to the route-discovery AiAgentInvoker
 * shape. The agent definition lives at
 * `.claude/agents/route-discovery-agent.md`.
 */
function wrapTaskInvokerForRouteDiscovery(taskInvoker: TaskInvoker): AiAgentInvoker {
  return async ({ prompt }) => {
    const result = await taskInvoker({
      subagentType: 'route-discovery-agent',
      description: 'WCAG multi-page route discovery',
      prompt,
    });
    return result.text;
  };
}

function renderDryRun(result: RouteDiscoveryResult): void {
  console.log(
    chalk.bold(
      `Discovered ${result.routes.length} route(s) via "${result.strategy}" ` +
        `(confidence ${result.confidence.toFixed(2)}):`,
    ),
  );
  for (const route of result.routes) {
    const tag = route.isDynamic ? chalk.yellow('[dynamic]') : chalk.green('[static]');
    const sample = route.sampleUrl ? chalk.dim(` → ${route.sampleUrl}`) : '';
    console.log(`  ${tag} ${route.path} ${chalk.dim(`(${route.source})`)}${sample}`);
  }
  if (result.warnings.length > 0) {
    console.log(chalk.yellow(`\nWarnings:`));
    for (const warning of result.warnings) {
      console.log(chalk.yellow(`  ! ${warning}`));
    }
  }
}

function dedupeById(findings: readonly WcagFinding[]): WcagFinding[] {
  const seen = new Set<string>();
  const out: WcagFinding[] = [];
  for (const finding of findings) {
    if (seen.has(finding.id)) continue;
    seen.add(finding.id);
    out.push(finding);
  }
  return out;
}
