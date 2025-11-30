/**
 * A pragmatic subset of WAI-ARIA 1.2, focused on the roles and required
 * attributes we actually validate in static analysis. Not exhaustive -
 * dynamic testing (axe-core) covers the long tail.
 *
 * Source of truth: {@link https://www.w3.org/TR/wai-aria-1.2/ | WAI-ARIA 1.2}.
 */

/** Non-abstract ARIA roles we recognize as valid. */
export const VALID_ARIA_ROLES: ReadonlySet<string> = new Set([
  // Landmark
  'banner',
  'complementary',
  'contentinfo',
  'form',
  'main',
  'navigation',
  'region',
  'search',
  // Document structure
  'article',
  'cell',
  'columnheader',
  'definition',
  'directory',
  'document',
  'feed',
  'figure',
  'group',
  'heading',
  'img',
  'list',
  'listitem',
  'math',
  'meter',
  'none',
  'note',
  'presentation',
  'row',
  'rowgroup',
  'rowheader',
  'separator',
  'table',
  'term',
  'toolbar',
  'tooltip',
  // Widget
  'alert',
  'alertdialog',
  'application',
  'button',
  'checkbox',
  'combobox',
  'dialog',
  'grid',
  'gridcell',
  'link',
  'listbox',
  'log',
  'marquee',
  'menu',
  'menubar',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'progressbar',
  'radio',
  'radiogroup',
  'scrollbar',
  'searchbox',
  'slider',
  'spinbutton',
  'status',
  'switch',
  'tab',
  'tablist',
  'tabpanel',
  'textbox',
  'timer',
  'tree',
  'treegrid',
  'treeitem',
]);

/**
 * Required ARIA states/properties per role.
 *
 * Only the *state* attributes that MUST be set for the role to be complete
 * are listed here - things the user agent cannot infer. Labelling
 * attributes (aria-label / aria-labelledby / visible text) are checked
 * separately.
 */
export const REQUIRED_ARIA_ATTRS: ReadonlyMap<string, readonly string[]> = new Map([
  ['checkbox', ['aria-checked']],
  ['switch', ['aria-checked']],
  ['radio', ['aria-checked']],
  ['combobox', ['aria-expanded']],
  ['slider', ['aria-valuenow']],
  ['spinbutton', ['aria-valuenow']],
  ['scrollbar', ['aria-controls', 'aria-valuenow']],
  ['heading', ['aria-level']],
  ['option', ['aria-selected']],
  ['treeitem', ['aria-selected']],
]);

/**
 * Elements that are always keyboard-focusable by the browser and therefore
 * must not be marked `aria-hidden="true"` without also removing them from the
 * tab order.
 */
export const NATIVELY_FOCUSABLE_TAGS: ReadonlySet<string> = new Set([
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'details',
  'iframe',
]);
