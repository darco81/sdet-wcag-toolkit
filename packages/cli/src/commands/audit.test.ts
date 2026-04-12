/**
 * Behavior tests for the `audit` command's argument plumbing - chiefly
 * the v0.3 `--use-ai` flag. The full audit pipeline is exercised in
 * integration.test.ts; this file isolates flag handling.
 */

import { Command } from 'commander';
import { describe, expect, it } from 'vitest';

import { registerAuditCommand, runAudit } from './audit.js';

describe('registerAuditCommand', () => {
  it('exposes --use-ai as a boolean flag (default false)', () => {
    const program = new Command();
    const cmd = registerAuditCommand(program);
    const options = cmd.options.map((o) => o.long);
    expect(options).toContain('--use-ai');
    const useAi = cmd.options.find((o) => o.long === '--use-ai');
    expect(useAi?.defaultValue).toBe(false);
  });

  it('keeps the v0.2 flags intact for backward compatibility', () => {
    const program = new Command();
    const cmd = registerAuditCommand(program);
    const longs = cmd.options.map((o) => o.long);
    expect(longs).toEqual(
      expect.arrayContaining(['--url', '--wait-for', '--json', '--top', '--use-ai']),
    );
  });

  it('audit help text mentions --use-ai', () => {
    const program = new Command();
    const cmd = registerAuditCommand(program);
    const help = cmd.helpInformation();
    expect(help).toContain('--use-ai');
    expect(help).toMatch(/specialist|Claude Code|--use-ai/);
  });
});

describe('runAudit input validation', () => {
  it('refuses --use-ai without a path', async () => {
    await expect(
      runAudit(undefined, {
        json: false,
        top: '10',
        useAi: true,
      } as Parameters<typeof runAudit>[1]),
    ).rejects.toThrow(/AI agents require a source path/);
  });

  it('still requires either path or url', async () => {
    await expect(
      runAudit(undefined, {
        json: false,
        top: '10',
        useAi: false,
      } as Parameters<typeof runAudit>[1]),
    ).rejects.toThrow(/Provide a path argument, a --url, or both/);
  });
});
