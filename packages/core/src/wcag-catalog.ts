/**
 * WCAG 2.2 catalog, Level A and AA.
 *
 * Source: {@link https://www.w3.org/TR/WCAG22/ | W3C Web Content Accessibility Guidelines 2.2}.
 *
 * Notes:
 * - 4.1.1 Parsing was **removed** in WCAG 2.2 and is therefore not in this list.
 * - Six criteria were added in 2.2: 2.4.11, 2.5.7, 2.5.8 (AA) and 3.2.6, 3.3.7 (A),
 *   plus 3.3.8 (AA). The AAA-only additions (2.4.12, 2.4.13, 3.3.9) are out of scope.
 * - AAA criteria are out of scope for this catalog since the toolkit targets Level AA
 *   conformance, which is the legal baseline in the EU (EAA) and most US state laws.
 */

import type { WcagSuccessCriterion } from './types.js';

const W3C_BASE = 'https://www.w3.org/WAI/WCAG22/Understanding';

function sc(
  id: string,
  name: string,
  level: 'A' | 'AA',
  principle: 'perceivable' | 'operable' | 'understandable' | 'robust',
  introducedIn: '2.0' | '2.1' | '2.2',
  slug: string,
): WcagSuccessCriterion {
  return { id, name, level, principle, introducedIn, url: `${W3C_BASE}/${slug}` };
}

// Perceivable
const PERCEIVABLE: readonly WcagSuccessCriterion[] = [
  sc('1.1.1', 'Non-text Content', 'A', 'perceivable', '2.0', 'non-text-content'),
  sc(
    '1.2.1',
    'Audio-only and Video-only (Prerecorded)',
    'A',
    'perceivable',
    '2.0',
    'audio-only-and-video-only-prerecorded',
  ),
  sc('1.2.2', 'Captions (Prerecorded)', 'A', 'perceivable', '2.0', 'captions-prerecorded'),
  sc(
    '1.2.3',
    'Audio Description or Media Alternative (Prerecorded)',
    'A',
    'perceivable',
    '2.0',
    'audio-description-or-media-alternative-prerecorded',
  ),
  sc('1.2.4', 'Captions (Live)', 'AA', 'perceivable', '2.0', 'captions-live'),
  sc(
    '1.2.5',
    'Audio Description (Prerecorded)',
    'AA',
    'perceivable',
    '2.0',
    'audio-description-prerecorded',
  ),
  sc('1.3.1', 'Info and Relationships', 'A', 'perceivable', '2.0', 'info-and-relationships'),
  sc('1.3.2', 'Meaningful Sequence', 'A', 'perceivable', '2.0', 'meaningful-sequence'),
  sc('1.3.3', 'Sensory Characteristics', 'A', 'perceivable', '2.0', 'sensory-characteristics'),
  sc('1.3.4', 'Orientation', 'AA', 'perceivable', '2.1', 'orientation'),
  sc('1.3.5', 'Identify Input Purpose', 'AA', 'perceivable', '2.1', 'identify-input-purpose'),
  sc('1.4.1', 'Use of Color', 'A', 'perceivable', '2.0', 'use-of-color'),
  sc('1.4.2', 'Audio Control', 'A', 'perceivable', '2.0', 'audio-control'),
  sc('1.4.3', 'Contrast (Minimum)', 'AA', 'perceivable', '2.0', 'contrast-minimum'),
  sc('1.4.4', 'Resize Text', 'AA', 'perceivable', '2.0', 'resize-text'),
  sc('1.4.5', 'Images of Text', 'AA', 'perceivable', '2.0', 'images-of-text'),
  sc('1.4.10', 'Reflow', 'AA', 'perceivable', '2.1', 'reflow'),
  sc('1.4.11', 'Non-text Contrast', 'AA', 'perceivable', '2.1', 'non-text-contrast'),
  sc('1.4.12', 'Text Spacing', 'AA', 'perceivable', '2.1', 'text-spacing'),
  sc(
    '1.4.13',
    'Content on Hover or Focus',
    'AA',
    'perceivable',
    '2.1',
    'content-on-hover-or-focus',
  ),
];

// Operable
const OPERABLE: readonly WcagSuccessCriterion[] = [
  sc('2.1.1', 'Keyboard', 'A', 'operable', '2.0', 'keyboard'),
  sc('2.1.2', 'No Keyboard Trap', 'A', 'operable', '2.0', 'no-keyboard-trap'),
  sc('2.1.4', 'Character Key Shortcuts', 'A', 'operable', '2.1', 'character-key-shortcuts'),
  sc('2.2.1', 'Timing Adjustable', 'A', 'operable', '2.0', 'timing-adjustable'),
  sc('2.2.2', 'Pause, Stop, Hide', 'A', 'operable', '2.0', 'pause-stop-hide'),
  sc(
    '2.3.1',
    'Three Flashes or Below Threshold',
    'A',
    'operable',
    '2.0',
    'three-flashes-or-below-threshold',
  ),
  sc('2.4.1', 'Bypass Blocks', 'A', 'operable', '2.0', 'bypass-blocks'),
  sc('2.4.2', 'Page Titled', 'A', 'operable', '2.0', 'page-titled'),
  sc('2.4.3', 'Focus Order', 'A', 'operable', '2.0', 'focus-order'),
  sc('2.4.4', 'Link Purpose (In Context)', 'A', 'operable', '2.0', 'link-purpose-in-context'),
  sc('2.4.5', 'Multiple Ways', 'AA', 'operable', '2.0', 'multiple-ways'),
  sc('2.4.6', 'Headings and Labels', 'AA', 'operable', '2.0', 'headings-and-labels'),
  sc('2.4.7', 'Focus Visible', 'AA', 'operable', '2.0', 'focus-visible'),
  sc(
    '2.4.11',
    'Focus Not Obscured (Minimum)',
    'AA',
    'operable',
    '2.2',
    'focus-not-obscured-minimum',
  ),
  sc('2.5.1', 'Pointer Gestures', 'A', 'operable', '2.1', 'pointer-gestures'),
  sc('2.5.2', 'Pointer Cancellation', 'A', 'operable', '2.1', 'pointer-cancellation'),
  sc('2.5.3', 'Label in Name', 'A', 'operable', '2.1', 'label-in-name'),
  sc('2.5.4', 'Motion Actuation', 'A', 'operable', '2.1', 'motion-actuation'),
  sc('2.5.7', 'Dragging Movements', 'AA', 'operable', '2.2', 'dragging-movements'),
  sc('2.5.8', 'Target Size (Minimum)', 'AA', 'operable', '2.2', 'target-size-minimum'),
];

// Understandable
const UNDERSTANDABLE: readonly WcagSuccessCriterion[] = [
  sc('3.1.1', 'Language of Page', 'A', 'understandable', '2.0', 'language-of-page'),
  sc('3.1.2', 'Language of Parts', 'AA', 'understandable', '2.0', 'language-of-parts'),
  sc('3.2.1', 'On Focus', 'A', 'understandable', '2.0', 'on-focus'),
  sc('3.2.2', 'On Input', 'A', 'understandable', '2.0', 'on-input'),
  sc('3.2.3', 'Consistent Navigation', 'AA', 'understandable', '2.0', 'consistent-navigation'),
  sc(
    '3.2.4',
    'Consistent Identification',
    'AA',
    'understandable',
    '2.0',
    'consistent-identification',
  ),
  sc('3.2.6', 'Consistent Help', 'A', 'understandable', '2.2', 'consistent-help'),
  sc('3.3.1', 'Error Identification', 'A', 'understandable', '2.0', 'error-identification'),
  sc('3.3.2', 'Labels or Instructions', 'A', 'understandable', '2.0', 'labels-or-instructions'),
  sc('3.3.3', 'Error Suggestion', 'AA', 'understandable', '2.0', 'error-suggestion'),
  sc(
    '3.3.4',
    'Error Prevention (Legal, Financial, Data)',
    'AA',
    'understandable',
    '2.0',
    'error-prevention-legal-financial-data',
  ),
  sc('3.3.7', 'Redundant Entry', 'A', 'understandable', '2.2', 'redundant-entry'),
  sc(
    '3.3.8',
    'Accessible Authentication (Minimum)',
    'AA',
    'understandable',
    '2.2',
    'accessible-authentication-minimum',
  ),
];

// Robust
const ROBUST: readonly WcagSuccessCriterion[] = [
  sc('4.1.2', 'Name, Role, Value', 'A', 'robust', '2.0', 'name-role-value'),
  sc('4.1.3', 'Status Messages', 'AA', 'robust', '2.1', 'status-messages'),
];

/**
 * All Level A and AA success criteria from WCAG 2.2. Ordered by id.
 * 55 criteria total (31 Level A, 24 Level AA).
 */
export const WCAG_2_2_AA_CATALOG: readonly WcagSuccessCriterion[] = [
  ...PERCEIVABLE,
  ...OPERABLE,
  ...UNDERSTANDABLE,
  ...ROBUST,
];

/** Index for O(1) lookup by SC number (e.g. "1.3.1"). */
const BY_ID: ReadonlyMap<string, WcagSuccessCriterion> = new Map(
  WCAG_2_2_AA_CATALOG.map((criterion) => [criterion.id, criterion]),
);

/**
 * Look up a success criterion by its dotted id (e.g. "1.3.1"). Returns
 * `undefined` if the id is not in the Level A/AA catalog (e.g. AAA-only).
 */
export function findSuccessCriterion(id: string): WcagSuccessCriterion | undefined {
  return BY_ID.get(id);
}

/**
 * Like {@link findSuccessCriterion} but throws a descriptive error if the id
 * is not found. Use when an analyzer references a SC it *should* know about.
 */
export function requireSuccessCriterion(id: string): WcagSuccessCriterion {
  const found = BY_ID.get(id);
  if (!found) {
    throw new Error(
      `Unknown WCAG 2.2 A/AA success criterion: "${id}". ` +
        `Either the id is wrong, or it refers to a Level AAA criterion not tracked by this toolkit.`,
    );
  }
  return found;
}
