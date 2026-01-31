/**
 * `audit` command. Three modes:
 *   - Static only: `wcag-toolkit audit ./src`
 *   - Dynamic only: `wcag-toolkit audit --url https://example.com`
 *   - Both:        `wcag-toolkit audit ./src --url https://example.com`
 *
 * Dynamic mode navigates to the URL with Playwright and runs axe +
 * keyboard-flow + focus-visibility against the rendered page. Both
 * modes share the same WcagFinding shape and dedupe across paths.
 */

import { resolve } from 'node:path';

import chalk from 'chalk';
import { Command } from 'commander';

import type { WcagFinding } from '@sdet-wcag-toolkit/core';
import { createDefaultDynamicOrchestrator } from '@sdet-wcag-toolkit/dynamic-tester';
import { createDefaultOrchestrator, loadSources } from '@sdet-wcag-toolkit/static-analyzer';

import { formatConsoleReport } from '../reporters/console.js';

export interface AuditOptions {
  readonly url?: string;
  readonly json: boolean;
  readonly top: string;
  readonly waitFor?: string;
}

export function registerAuditCommand(program: Command): Command {
  return program
    .command('audit')
    .description('Run a WCAG 2.2 AA audit against a directory, a URL, or both')
    .argument('[path]', 'Directory to analyze (static path). Omit for URL-only audits.')
    .option('--url <url>', 'URL to audit dynamically with Playwright + axe-core')
    .option(
      '--wait-for <selector>',
      'Wait for this CSS selector before running the dynamic audit',
    )
    .option('--json', 'Emit findings as JSON to stdout', false)
    .option('--top <n>', 'How many top-priority findings to show in console output', '10')
    .action(async (pathArg: string | undefined, options: AuditOptions) => {
      await runAudit(pathArg, options);
    });
}

export async function runAudit(
  pathArg: string | undefined,
  options: AuditOptions,
): Promise<void> {
  if (!pathArg && !options.url) {
    throw new Error('Provide a path argument, a --url, or both.');
  }

  const findings: WcagFinding[] = [];

  if (pathArg) {
    const rootDir = resolve(process.cwd(), pathArg);
    const context = await loadSources({ rootDir });
    const staticFindings = createDefaultOrchestrator().run(context);
    findings.push(...staticFindings);
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
    // Purely cosmetic hint - the user explicitly asked for a dynamic run.
    console.log(chalk.dim('\n(Dynamic audit complete.)'));
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
