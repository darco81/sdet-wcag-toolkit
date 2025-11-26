export type {
  WcagFinding,
  WcagFindingLocation,
  WcagFindingSource,
  WcagLevel,
  WcagPrinciple,
  WcagSeverity,
  WcagSuccessCriterion,
} from './types.js';

export {
  WCAG_2_2_AA_CATALOG,
  findSuccessCriterion,
  requireSuccessCriterion,
} from './wcag-catalog.js';

export type { SeverityBreakdown, WcagGrade } from './severity.js';
export {
  SEVERITY_WEIGHT,
  aggregateScore,
  countBySeverity,
  gradeFor,
  gradeWithCriticalPenalty,
} from './severity.js';

export type { EffortFn, FixEffort } from './priority.js';
export {
  DEFAULT_EFFORT,
  DEFAULT_RULE_EFFORT,
  effortOf,
  priorityOf,
  sortByPriority,
} from './priority.js';
