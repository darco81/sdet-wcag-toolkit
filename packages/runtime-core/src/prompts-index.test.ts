import { describe, expect, it } from 'vitest';

import {
  PROMPT_INDEX,
  SPECIALIST_AGENT_IDS,
  loadAllSystemPrompts,
  loadSystemPrompt,
} from './prompts-index.js';

describe('SPECIALIST_AGENT_IDS', () => {
  it('contains exactly the 5 v0.3 specialists', () => {
    expect([...SPECIALIST_AGENT_IDS].sort()).toEqual([
      'aria-patterns',
      'color-contrast-static',
      'forms-accessibility',
      'keyboard-interaction',
      'semantic-structure',
    ]);
  });

  it('keys of PROMPT_INDEX match SPECIALIST_AGENT_IDS', () => {
    expect(Object.keys(PROMPT_INDEX).sort()).toEqual([...SPECIALIST_AGENT_IDS].sort());
  });
});

describe('loadSystemPrompt', () => {
  it('loads semantic-structure prompt and includes the new 3.1.2 + modal heading rules', async () => {
    const prompt = await loadSystemPrompt('semantic-structure');
    expect(prompt).toContain('semantic-structure');
    expect(prompt).toContain('3.1.2');
    expect(prompt).toContain('modal');
  });

  it('loads aria-patterns prompt and includes live-region + dialog-type rules', async () => {
    const prompt = await loadSystemPrompt('aria-patterns');
    expect(prompt).toContain('aria-patterns');
    expect(prompt).toContain('Live-region');
    expect(prompt).toContain('Dialog-type');
  });

  it('loads keyboard-interaction prompt and includes composite-widget rule', async () => {
    const prompt = await loadSystemPrompt('keyboard-interaction');
    expect(prompt).toContain('keyboard-interaction');
    expect(prompt).toContain('Composite widget');
    expect(prompt).toMatch(/tablist|listbox|combobox/i);
  });

  it('loads color-contrast-static prompt and includes prefers-* + 1.4.1 rules', async () => {
    const prompt = await loadSystemPrompt('color-contrast-static');
    expect(prompt).toContain('color-contrast-static');
    expect(prompt).toContain('prefers-reduced-motion');
    expect(prompt).toContain('1.4.1');
  });

  it('loads forms-accessibility prompt and includes 3.3.4 + validation timing', async () => {
    const prompt = await loadSystemPrompt('forms-accessibility');
    expect(prompt).toContain('forms-accessibility');
    expect(prompt).toContain('3.3.4');
    expect(prompt).toContain('blur');
  });
});

describe('loadAllSystemPrompts', () => {
  it('loads all 5 prompts in one call', async () => {
    const prompts = await loadAllSystemPrompts();
    expect(Object.keys(prompts).sort()).toEqual([
      'aria-patterns',
      'color-contrast-static',
      'forms-accessibility',
      'keyboard-interaction',
      'semantic-structure',
    ]);
    for (const value of Object.values(prompts)) {
      expect(value.length).toBeGreaterThan(100);
    }
  });
});
