/**
 * Small helpers for producing {@link WcagFinding} values with stable ids.
 *
 * The id is a deterministic hash of (successCriterion, ruleId, location) so
 * identical findings from different analyzers collapse to one entry when the
 * orchestrator runs dedup.
 */

import type {
  WcagFinding,
  WcagFindingLocation,
  WcagFindingSource,
  WcagSeverity,
  WcagSuccessCriterion,
} from '@sdet-wcag-toolkit/core';

export interface CreateFindingInput {
  readonly successCriterion: WcagSuccessCriterion;
  readonly severity: WcagSeverity;
  readonly message: string;
  readonly rationale?: string;
  readonly remediation?: string;
  readonly location: WcagFindingLocation;
  readonly ruleId: string;
  readonly helpUrl?: string;
  readonly source?: WcagFindingSource;
}

export function createFinding(input: CreateFindingInput): WcagFinding {
  const id = hashFindingId(input.successCriterion.id, input.ruleId, input.location);
  return {
    id,
    successCriterion: input.successCriterion,
    severity: input.severity,
    message: input.message,
    ...(input.rationale !== undefined && { rationale: input.rationale }),
    ...(input.remediation !== undefined && { remediation: input.remediation }),
    location: input.location,
    source: input.source ?? 'static',
    ruleId: input.ruleId,
    ...(input.helpUrl !== undefined && { helpUrl: input.helpUrl }),
  };
}

function hashFindingId(scId: string, ruleId: string, loc: WcagFindingLocation): string {
  const key = [
    scId,
    ruleId,
    loc.file ?? loc.url ?? '',
    loc.line ?? '',
    loc.column ?? '',
    loc.selector ?? '',
  ].join('|');
  return `sa-${djb2(key)}`;
}

/** Small non-cryptographic hash - stable across runs, short, collision-rare. */
function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}
