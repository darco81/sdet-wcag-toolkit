/**
 * `audit` command: runs the static analyzer against a directory and prints
 * a report. Supports `--static` (only mode in v0.1), `--json`, and `--top`.
 */

import { resolve } from 'node:path';

import chalk from 'chalk';
import { Command } from 'commander';

import { createDefaultOrchestrator, loadSources } from '@sdet-wcag-toolkit/static-analyzer';

import { formatConsoleReport } from '../reporters/console.js';

export interface AuditOptions {
  readonly static: boolean;
  readonly json: boolean;
  readonly top: string;
}

export function registerAuditCommand(program: Command): Command {
  return program
    .command('audit')
    .description('Run a WCAG 2.2 AA audit against a directory of source files')
    .argument('<path>', 'Directory to analyze')
    .option('--static', 'Run the static analyzer (default in v0.1)', true)
    .option('--json', 'Emit findings as JSON to stdout', false)
    .option('--top <n>', 'How many top-priority findings to show in console output', '10')
    .action(async (pathArg: string, options: AuditOptions) => {
      await runAudit(pathArg, options);
    });
}

export async function runAudit(pathArg: string, options: AuditOptions): Promise<void> {
  const rootDir = resolve(process.cwd(), pathArg);

  if (!options.static) {
    console.error(chalk.yellow('Dynamic audit is not available in v0.1. Falling back to --static.'));
  }

  const context = await loadSources({ rootDir });
  const orchestrator = createDefaultOrchestrator();
  const findings = orchestrator.run(context);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(findings, null, 2)}\n`);
    return;
  }

  const top = Number.parseInt(options.top, 10);
  const report = formatConsoleReport(findings, { top: Number.isFinite(top) ? top : 10 });
  console.log(report);

  // Exit non-zero when Critical or Serious findings are present so CI fails.
  const blocking = findings.some((f) => f.severity === 'critical' || f.severity === 'serious');
  if (blocking) process.exitCode = 1;
}
