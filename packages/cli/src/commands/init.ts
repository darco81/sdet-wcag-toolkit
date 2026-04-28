/**
 * `init` command: copies this repo's `.claude/` (agents, skills, commands)
 * into a target project so Claude Code picks them up automatically.
 *
 * In v0.1 this works when running from a cloned repo - the source
 * `.claude/` is resolved relative to the CLI's install path. When the CLI
 * is eventually published to npm, we'll bundle the files into the package.
 */

import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import chalk from 'chalk';
import { Command } from 'commander';

export interface InitOptions {
  readonly force: boolean;
}

export function registerInitCommand(program: Command): Command {
  return program
    .command('init')
    .description('Copy the Claude Code agents, skills, and commands into a target project')
    .argument('[path]', 'Target project directory (default: current directory)', '.')
    .option('-f, --force', 'Overwrite existing files in the target .claude/', false)
    .action(async (pathArg: string, options: InitOptions) => {
      await runInit(pathArg, options);
    });
}

export async function runInit(pathArg: string, options: InitOptions): Promise<void> {
  const sourceDir = resolveSourceDir();
  const targetDir = resolve(process.cwd(), pathArg);
  const targetClaude = resolve(targetDir, '.claude');

  if (!existsSync(sourceDir)) {
    throw new Error(
      `Cannot find source .claude/ at ${sourceDir}. ` +
        `The init command only works when running from a cloned sdet-wcag-toolkit repo in v0.1.`,
    );
  }

  if (!existsSync(targetDir)) {
    throw new Error(`Target directory does not exist: ${targetDir}`);
  }

  await mkdir(targetClaude, { recursive: true });

  const summary = await copyTree(sourceDir, targetClaude, options.force);

  console.log(chalk.bold('wcag-toolkit init'));
  console.log(`  source: ${chalk.dim(sourceDir)}`);
  console.log(`  target: ${chalk.dim(targetClaude)}`);
  console.log('');
  console.log(
    `${chalk.green('✓')} copied ${summary.copied} file${summary.copied === 1 ? '' : 's'}`,
  );
  if (summary.skipped > 0) {
    console.log(
      `${chalk.yellow('!')} skipped ${summary.skipped} (already exist - pass --force to overwrite)`,
    );
  }
  console.log('');
  console.log('Next steps:');
  console.log('  1. Commit the new .claude/ directory to your repo.');
  console.log('  2. Open the project in Claude Code.');
  console.log('  3. Run /wcag:audit:static (or /wcag:audit once v0.2 lands).');
}

function resolveSourceDir(): string {
  // dist/commands/init.js → ../.. = dist → packages/cli → packages → repo root
  // Four levels up from the compiled module file lands on the repo root.
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..', '..', '..', '..', '.claude');
}

interface CopySummary {
  copied: number;
  skipped: number;
}

async function copyTree(
  sourceRoot: string,
  targetRoot: string,
  force: boolean,
): Promise<CopySummary> {
  const summary: CopySummary = { copied: 0, skipped: 0 };
  await walk(sourceRoot, sourceRoot, targetRoot, force, summary);
  return summary;
}

async function walk(
  root: string,
  dir: string,
  targetRoot: string,
  force: boolean,
  summary: CopySummary,
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = resolve(dir, entry.name);
    const rel = relative(root, sourcePath);
    const targetPath = resolve(targetRoot, rel);

    if (entry.isDirectory()) {
      await mkdir(targetPath, { recursive: true });
      await walk(root, sourcePath, targetRoot, force, summary);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!force && existsSync(targetPath)) {
      summary.skipped += 1;
      continue;
    }
    await mkdir(dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath, { force: true });
    summary.copied += 1;
  }
  // Access `stat` in one place so it stays imported for readability when we
  // need size checks in v0.2.
  void stat;
}
