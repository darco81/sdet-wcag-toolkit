/**
 * Programmatic access to the shared specialist prompts.
 *
 * The Markdown files in `./prompts/` are the single source of truth.
 * At build time, the `copy-prompts` script copies them into
 * `dist/prompts/`; at runtime, the loader reads them from there.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type SpecialistAgentId =
  | 'semantic-structure'
  | 'aria-patterns'
  | 'keyboard-interaction'
  | 'color-contrast-static'
  | 'forms-accessibility';

export const SPECIALIST_AGENT_IDS: readonly SpecialistAgentId[] = [
  'semantic-structure',
  'aria-patterns',
  'keyboard-interaction',
  'color-contrast-static',
  'forms-accessibility',
];

/** Filename mapping for the bundled prompts. Used both for discovery
 *  (which files to copy at build time) and as a stable index callers
 *  can import to enumerate available agents. */
export const PROMPT_INDEX: Readonly<Record<SpecialistAgentId, string>> = {
  'semantic-structure': 'semantic-structure.md',
  'aria-patterns': 'aria-patterns.md',
  'keyboard-interaction': 'keyboard-interaction.md',
  'color-contrast-static': 'color-contrast-static.md',
  'forms-accessibility': 'forms-accessibility.md',
};

const here = dirname(fileURLToPath(import.meta.url));
const promptsDir = join(here, 'prompts');

/** Load a specialist system prompt from the filesystem. */
export async function loadSystemPrompt(id: SpecialistAgentId): Promise<string> {
  const filename = PROMPT_INDEX[id];
  return readFile(join(promptsDir, filename), 'utf8');
}

/** Load every specialist prompt at once. */
export async function loadAllSystemPrompts(): Promise<
  Record<SpecialistAgentId, string>
> {
  const entries = await Promise.all(
    SPECIALIST_AGENT_IDS.map(
      async (id) => [id, await loadSystemPrompt(id)] as const,
    ),
  );
  return Object.fromEntries(entries) as Record<SpecialistAgentId, string>;
}
