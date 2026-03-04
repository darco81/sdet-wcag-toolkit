import { describe, expect, it } from 'vitest';

import {
  ALLOWED_AUDIT_TOOLS,
  DENIED_AUDIT_TOOLS,
  isAllowedAuditTool,
  isDeniedTool,
  sanitizeAgentTools,
} from './guard.js';
import type { ToolDefinition } from './types.js';

function tool(name: string): ToolDefinition {
  return { name, description: `${name} tool` };
}

describe('sanitizeAgentTools', () => {
  it('keeps allowed read-only tools', () => {
    const result = sanitizeAgentTools([tool('Read'), tool('Grep'), tool('Glob')]);
    expect(result.map((t) => t.name)).toEqual(['Read', 'Grep', 'Glob']);
  });

  it('drops denied tools silently by default', () => {
    const result = sanitizeAgentTools([
      tool('Read'),
      tool('Bash'),
      tool('Grep'),
      tool('WebFetch'),
    ]);
    expect(result.map((t) => t.name)).toEqual(['Read', 'Grep']);
  });

  it('drops unknown tools even when not explicitly denied', () => {
    const result = sanitizeAgentTools([tool('Read'), tool('MysteryTool')]);
    expect(result.map((t) => t.name)).toEqual(['Read']);
  });

  it('throws in strict mode when a denied tool is present', () => {
    expect(() =>
      sanitizeAgentTools([tool('Read'), tool('Bash')], { strict: true }),
    ).toThrow(/HardGuard.*Bash/);
  });

  it('does not throw in strict mode when only allowed tools are present', () => {
    expect(() =>
      sanitizeAgentTools([tool('Read'), tool('Grep')], { strict: true }),
    ).not.toThrow();
  });

  it('returns empty array for empty input', () => {
    expect(sanitizeAgentTools([])).toEqual([]);
  });

  it('preserves order of kept tools', () => {
    const result = sanitizeAgentTools([
      tool('Glob'),
      tool('Bash'),
      tool('Read'),
      tool('Grep'),
    ]);
    expect(result.map((t) => t.name)).toEqual(['Glob', 'Read', 'Grep']);
  });
});

describe('predicate helpers', () => {
  it('isDeniedTool returns true for every denied tool in the set', () => {
    for (const name of DENIED_AUDIT_TOOLS) {
      expect(isDeniedTool(name)).toBe(true);
    }
  });

  it('isAllowedAuditTool returns true for every allowed tool in the set', () => {
    for (const name of ALLOWED_AUDIT_TOOLS) {
      expect(isAllowedAuditTool(name)).toBe(true);
    }
  });

  it('isDeniedTool is false for unknown names', () => {
    expect(isDeniedTool('Hamburger')).toBe(false);
  });
});

describe('denylist content', () => {
  it('includes all dangerous write tools', () => {
    for (const denied of ['Bash', 'Exec', 'Shell', 'WebFetch', 'WebSearch', 'Write', 'Edit']) {
      expect(DENIED_AUDIT_TOOLS.has(denied)).toBe(true);
    }
  });

  it('allowlist intersect denylist is empty', () => {
    for (const name of ALLOWED_AUDIT_TOOLS) {
      expect(DENIED_AUDIT_TOOLS.has(name)).toBe(false);
    }
  });
});
