import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runInit } from './init.js';

describe('wcag-toolkit init', () => {
  let target: string;

  beforeEach(async () => {
    target = await mkdtemp(join(tmpdir(), 'wcag-init-'));
  });

  afterEach(async () => {
    await rm(target, { recursive: true, force: true });
  });

  it('copies every agent, skill, and command into target/.claude/', async () => {
    await runInit(target, { force: false });
    expect(existsSync(join(target, '.claude', 'agents', 'wcag-lead.md'))).toBe(true);
    expect(existsSync(join(target, '.claude', 'agents', 'semantic-structure-agent.md'))).toBe(true);
    expect(existsSync(join(target, '.claude', 'agents', 'aria-patterns-agent.md'))).toBe(true);
    expect(existsSync(join(target, '.claude', 'agents', 'keyboard-interaction-agent.md'))).toBe(true);
    expect(existsSync(join(target, '.claude', 'agents', 'color-contrast-static-agent.md'))).toBe(true);
    expect(existsSync(join(target, '.claude', 'skills', 'wcag-static-analyze', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(target, '.claude', 'commands', 'wcag', 'audit', 'static.md'))).toBe(true);
    expect(existsSync(join(target, '.claude', 'commands', 'wcag', 'init.md'))).toBe(true);
    // v0.3 skills + slash commands
    expect(existsSync(join(target, '.claude', 'skills', 'wcag-audit', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(target, '.claude', 'skills', 'wcag-fix', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(target, '.claude', 'commands', 'wcag', 'audit.md'))).toBe(true);
    expect(existsSync(join(target, '.claude', 'commands', 'wcag', 'fix.md'))).toBe(true);
  });

  it('skips files that already exist when --force is not set', async () => {
    const path = join(target, '.claude', 'agents', 'wcag-lead.md');
    await mkdir(join(target, '.claude', 'agents'), { recursive: true });
    await writeFile(path, '# existing content - do not overwrite', 'utf8');

    await runInit(target, { force: false });

    const { readFile } = await import('node:fs/promises');
    const after = await readFile(path, 'utf8');
    expect(after).toBe('# existing content - do not overwrite');
  });

  it('overwrites existing files when --force is set', async () => {
    const path = join(target, '.claude', 'agents', 'wcag-lead.md');
    await mkdir(join(target, '.claude', 'agents'), { recursive: true });
    await writeFile(path, '# old', 'utf8');

    await runInit(target, { force: true });

    const { readFile } = await import('node:fs/promises');
    const after = await readFile(path, 'utf8');
    expect(after).not.toBe('# old');
    expect(after).toContain('name: wcag-lead');
  });

  it('throws a friendly error when the target directory does not exist', async () => {
    await expect(runInit(join(target, 'nope'), { force: false })).rejects.toThrow(
      /Target directory does not exist/,
    );
  });
});
