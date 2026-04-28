/**
 * `report` command: regenerate a markdown report from a previously saved
 * findings JSON (the `--json` output of `audit`). Useful for iterating on
 * the report format without re-running the full audit.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import chalk from 'chalk';
import { Command } from 'commander';

import type { WcagFinding } from '@sdet-wcag-toolkit/core';
import { formatDevReport, formatExecSummary } from '@sdet-wcag-toolkit/reporter';

export type ReportFormat = 'dev' | 'exec';

export interface ReportOptions {
  readonly from: string;
  readonly format: ReportFormat;
  readonly output?: string;
  readonly title?: string;
  readonly target?: string;
}

export function registerReportCommand(program: Command): Command {
  return program
    .command('report')
    .description('Generate a markdown report from a saved findings JSON file')
    .requiredOption('--from <file>', 'Path to a JSON file produced by `wcag-toolkit audit --json`')
    .option('--format <format>', 'Report format: "dev" (default) or "exec"', 'dev')
    .option('--output <file>', 'Write markdown to a file instead of stdout')
    .option('--title <title>', 'Override the report title')
    .option('--target <target>', 'Short name of the audited product (exec format only)')
    .action(async (options: ReportOptions) => {
      await runReport(options);
    });
}

export async function runReport(options: ReportOptions): Promise<void> {
  const input = resolve(process.cwd(), options.from);
  const raw = await readFile(input, 'utf8');
  const findings = JSON.parse(raw) as WcagFinding[];
  if (!Array.isArray(findings)) {
    throw new Error(
      `Expected ${input} to contain a JSON array of findings, got ${typeof findings}.`,
    );
  }

  const markdown =
    options.format === 'exec'
      ? formatExecSummary(findings, {
          ...(options.title !== undefined && { title: options.title }),
          ...(options.target !== undefined && { target: options.target }),
        })
      : formatDevReport(findings, {
          ...(options.title !== undefined && { title: options.title }),
        });

  if (options.output) {
    const outPath = resolve(process.cwd(), options.output);
    await writeFile(outPath, markdown, 'utf8');
    console.log(chalk.green(`✓ wrote ${outPath} (${markdown.length} chars)`));
    return;
  }

  process.stdout.write(markdown);
}
