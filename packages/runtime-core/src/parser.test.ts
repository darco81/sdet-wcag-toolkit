import { describe, expect, it } from 'vitest';

import { ParseError, parseAgentOutput } from './parser.js';

const VALID_FINDING = {
  ruleId: 'img-alt-missing',
  successCriterionId: '1.1.1',
  severity: 'serious',
  message: '<img> missing alt',
  location: { file: 'src/App.jsx', line: 12 },
};

describe('parseAgentOutput', () => {
  it('returns empty array for empty input', () => {
    expect(parseAgentOutput('', 'semantic-structure')).toEqual([]);
    expect(parseAgentOutput('   ', 'semantic-structure')).toEqual([]);
  });

  it('parses a fenced json block', () => {
    const raw = `Here are the findings:\n\n\`\`\`json\n${JSON.stringify([VALID_FINDING])}\n\`\`\``;
    const findings = parseAgentOutput(raw, 'semantic-structure');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe('img-alt-missing');
    expect(findings[0]?.successCriterion.id).toBe('1.1.1');
    expect(findings[0]?.successCriterion.name).toBe('Non-text Content');
  });

  it('parses a bare array without code fence', () => {
    const findings = parseAgentOutput(JSON.stringify([VALID_FINDING]), 'a');
    expect(findings).toHaveLength(1);
  });

  it('parses an envelope `{ findings: [...] }`', () => {
    const envelope = { findings: [VALID_FINDING] };
    const raw = `\`\`\`json\n${JSON.stringify(envelope)}\n\`\`\``;
    expect(parseAgentOutput(raw, 'a')).toHaveLength(1);
  });

  it('strips <think>...</think> scratchpad', () => {
    const raw =
      '<think>I need to scan for <img> tags…</think>\n\n```json\n' +
      JSON.stringify([VALID_FINDING]) +
      '\n```';
    const findings = parseAgentOutput(raw, 'a');
    expect(findings).toHaveLength(1);
  });

  it('strips multiple <think> blocks', () => {
    const raw = '<think>first</think> some text <think>second</think>\n```json\n[]\n```';
    expect(parseAgentOutput(raw, 'a')).toEqual([]);
  });

  it('returns empty array when agent reported []', () => {
    expect(parseAgentOutput('```json\n[]\n```', 'a')).toEqual([]);
  });

  it('throws ParseError on invalid JSON', () => {
    expect(() => parseAgentOutput('```json\nnot-json\n```', 'a')).toThrow(ParseError);
  });

  it('throws ParseError when output is not an array or envelope', () => {
    expect(() => parseAgentOutput('```json\n{"foo": 1}\n```', 'a')).toThrow(/non-array/);
  });

  it('throws ParseError when a finding is missing required fields', () => {
    const bad = [{ severity: 'serious' }];
    expect(() => parseAgentOutput(`\`\`\`json\n${JSON.stringify(bad)}\n\`\`\``, 'a')).toThrow(
      ParseError,
    );
  });

  it('skips findings whose success criterion is not in the catalog', () => {
    const bogus = { ...VALID_FINDING, successCriterionId: '9.9.9' };
    const findings = parseAgentOutput(`\`\`\`json\n${JSON.stringify([bogus])}\n\`\`\``, 'a');
    expect(findings).toEqual([]);
  });

  it('rejects unknown severity values', () => {
    const bogus = { ...VALID_FINDING, severity: 'show-stopper' };
    expect(() => parseAgentOutput(`\`\`\`json\n${JSON.stringify([bogus])}\n\`\`\``, 'a')).toThrow(
      ParseError,
    );
  });

  it('preserves optional fields (rationale, remediation, helpUrl)', () => {
    const rich = {
      ...VALID_FINDING,
      rationale: 'no alt text breaks SRs',
      remediation: 'add alt=""',
      helpUrl: 'https://www.w3.org/TR/WCAG22/#non-text-content',
    };
    const findings = parseAgentOutput(`\`\`\`json\n${JSON.stringify([rich])}\n\`\`\``, 'a');
    expect(findings[0]?.rationale).toBe('no alt text breaks SRs');
    expect(findings[0]?.remediation).toBe('add alt=""');
    expect(findings[0]?.helpUrl).toContain('w3.org');
  });

  it('handles fenced block without language tag', () => {
    const raw = '```\n' + JSON.stringify([VALID_FINDING]) + '\n```';
    expect(parseAgentOutput(raw, 'a')).toHaveLength(1);
  });

  it('grabs JSON when there is prose before but no fence', () => {
    const raw = `Audit complete. Findings:\n${JSON.stringify([VALID_FINDING])}`;
    const findings = parseAgentOutput(raw, 'a');
    expect(findings).toHaveLength(1);
  });

  it('ParseError carries the raw output for debugging', () => {
    try {
      parseAgentOutput('```json\nnope\n```', 'semantic-structure');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ParseError);
      expect((err as ParseError).raw).toContain('nope');
    }
  });

  it('derives a stable id from agentId + ruleId + location', () => {
    const findings = parseAgentOutput(
      `\`\`\`json\n${JSON.stringify([VALID_FINDING])}\n\`\`\``,
      'semantic-structure',
    );
    expect(findings[0]?.id).toBe('semantic-structure:img-alt-missing:src/App.jsx:12');
  });

  it('uses url fallback in id when no file is provided', () => {
    const urlFinding = {
      ...VALID_FINDING,
      location: { url: 'https://example.com', selector: 'img' },
    };
    const findings = parseAgentOutput(
      `\`\`\`json\n${JSON.stringify([urlFinding])}\n\`\`\``,
      'aria-patterns',
    );
    expect(findings[0]?.id).toContain('https://example.com');
  });
});
