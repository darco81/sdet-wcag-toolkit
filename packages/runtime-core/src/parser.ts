/**
 * Structured JSON parser for agent output.
 *
 * Hybrid models converge on the same "safe" pattern when asked to
 * produce machine-readable output: a fenced ```json``` block at the
 * end of the answer. This parser extracts that block, strips any
 * preceding `<think>...</think>` scratchpad, and validates against
 * the shared `WcagFinding` schema.
 */

import {
  WCAG_2_2_AA_CATALOG,
  type WcagFinding,
  type WcagSuccessCriterion,
} from '@sdet-wcag-toolkit/core';
import { z } from 'zod';

/** Error thrown when raw agent output cannot be reduced to findings.
 *  Carries the raw output for debug reports. */
export class ParseError extends Error {
  readonly raw: string;
  constructor(message: string, raw: string) {
    super(message);
    this.name = 'ParseError';
    this.raw = raw;
  }
}

const findingInputSchema = z
  .object({
    ruleId: z.string().min(1),
    successCriterionId: z.string().regex(/^\d+\.\d+\.\d+$/),
    severity: z.enum(['critical', 'serious', 'moderate', 'minor']),
    message: z.string().min(1),
    rationale: z.string().optional(),
    remediation: z.string().optional(),
    location: z
      .object({
        file: z.string().optional(),
        line: z.number().int().nonnegative().optional(),
        column: z.number().int().nonnegative().optional(),
        url: z.string().url().optional(),
        selector: z.string().optional(),
        snippet: z.string().optional(),
      })
      .default({}),
    helpUrl: z.string().url().optional(),
  })
  .passthrough();

const findingsArraySchema = z.array(findingInputSchema);

/**
 * Parse raw agent output into validated findings.
 */
export function parseAgentOutput(raw: string, agentId: string): WcagFinding[] {
  if (!raw || raw.trim() === '') {
    return [];
  }
  const cleaned = stripThinking(raw);
  const jsonStr = extractJsonBlock(cleaned);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new ParseError(
      `Agent "${agentId}" returned invalid JSON: ${(e as Error).message}`,
      raw,
    );
  }
  const arrayInput = Array.isArray(parsed)
    ? parsed
    : isEnvelope(parsed)
      ? parsed.findings
      : null;
  if (!arrayInput) {
    throw new ParseError(
      `Agent "${agentId}" returned non-array JSON (expected array or { findings: [] })`,
      raw,
    );
  }
  const validated = findingsArraySchema.safeParse(arrayInput);
  if (!validated.success) {
    throw new ParseError(
      `Agent "${agentId}" findings failed schema validation: ${validated.error.message}`,
      raw,
    );
  }

  const findings: WcagFinding[] = [];
  for (const input of validated.data) {
    const sc = findSuccessCriterion(input.successCriterionId);
    if (!sc) {
      continue;
    }
    findings.push({
      id: deriveId(agentId, input),
      successCriterion: sc,
      severity: input.severity,
      message: input.message,
      ...(input.rationale !== undefined && { rationale: input.rationale }),
      ...(input.remediation !== undefined && { remediation: input.remediation }),
      location: stripUndefined(input.location) as WcagFinding['location'],
      source: 'static',
      ruleId: input.ruleId,
      ...(input.helpUrl !== undefined && { helpUrl: input.helpUrl }),
    });
  }
  return findings;
}

function stripThinking(raw: string): string {
  return raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

function extractJsonBlock(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/m.exec(text);
  if (fenced) return fenced[1]!.trim();
  const firstBrace = text.search(/[\[{]/);
  if (firstBrace === -1) return text.trim();
  return text.slice(firstBrace).trim();
}

function isEnvelope(value: unknown): value is { findings: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'findings' in value &&
    Array.isArray((value as { findings: unknown }).findings)
  );
}

function findSuccessCriterion(scId: string): WcagSuccessCriterion | undefined {
  return WCAG_2_2_AA_CATALOG.find((c) => c.id === scId);
}

function deriveId(agentId: string, input: z.infer<typeof findingInputSchema>): string {
  const locationKey = input.location.file
    ? `${input.location.file}:${input.location.line ?? 0}`
    : (input.location.url ?? 'unknown');
  return `${agentId}:${input.ruleId}:${locationKey}`;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}
