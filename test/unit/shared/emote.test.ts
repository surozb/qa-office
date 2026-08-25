import { describe, it, expect } from 'vitest';
import { emoteFor } from '../../../src/shared/emote';

describe('emoteFor', () => {
  it.each([
    ['Grep', 'search'], ['Glob', 'search'], ['Read', 'read'],
    ['Edit', 'edit'], ['Write', 'edit'], ['NotebookEdit', 'edit'],
    ['Bash', 'shell'], ['PowerShell', 'shell'],
    ['mcp__playwright__browser_click', 'browser'],
    ['Skill', 'skill'], ['Agent', 'delegate'],
    ['mcp__ado__wit_query', 'other'], ['SomethingNew', 'other'],
  ])('%s → %s', (tool, emote) => { expect(emoteFor(tool)).toBe(emote); });
});
