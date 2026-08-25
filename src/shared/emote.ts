import type { Emote } from './types';

const EXACT: Record<string, Emote> = {
  Grep: 'search', Glob: 'search', WebSearch: 'search', WebFetch: 'read',
  Read: 'read', Edit: 'edit', Write: 'edit', NotebookEdit: 'edit',
  Bash: 'shell', PowerShell: 'shell', Skill: 'skill', Agent: 'delegate',
};

export function emoteFor(tool: string): Emote {
  const hit = EXACT[tool];
  if (hit) return hit;
  if (tool.startsWith('mcp__playwright')) return 'browser';
  return 'other';
}
