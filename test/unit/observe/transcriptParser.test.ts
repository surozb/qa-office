import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTranscriptLine } from '../../../src/main/observe/transcriptParser';

const lines = readFileSync(join(__dirname, '../../fixtures/transcript/sample.jsonl'), 'utf8').split('\n');
const L = (i: number) => lines[i]!;

describe('parseTranscriptLine', () => {
  it('typed user prompt → text event', () => {
    expect(parseTranscriptLine(L(0))).toEqual([
      { kind: 'text', sessionId: 'S1', at: '2026-08-24T07:09:10.000Z', role: 'user', text: 'hello we are testing the casMigration folder in dev' },
    ]);
  });
  it('ai-title → title event', () => {
    expect(parseTranscriptLine(L(1))).toEqual([{ kind: 'title', sessionId: 'S1', title: 'casMigration folder test' }]);
  });
  it('assistant tool_use → tool + usage + branch events', () => {
    expect(parseTranscriptLine(L(2))).toEqual([
      { kind: 'branch', sessionId: 'S1', branch: 'test/CPTR-3136-cas-migration' },
      { kind: 'tool', sessionId: 'S1', at: '2026-08-24T07:09:40.045Z', tool: 'Bash', emote: 'shell', summary: 'Find casMigration folder files' },
      { kind: 'usage', sessionId: 'S1', at: '2026-08-24T07:09:40.045Z', input: 2, output: 376, cacheRead: 53775 },
    ]);
  });
  it('tool_result user record → nothing', () => { expect(parseTranscriptLine(L(3))).toEqual([]); });
  it('Skill tool_use → tool event AND skill event', () => {
    const ev = parseTranscriptLine(L(4));
    expect(ev).toContainEqual({ kind: 'skill', sessionId: 'S1', at: '2026-08-24T07:09:50.000Z', skill: 'database-explorer' });
    expect(ev).toContainEqual({ kind: 'tool', sessionId: 'S1', at: '2026-08-24T07:09:50.000Z', tool: 'Skill', emote: 'skill', summary: 'database-explorer' });
  });
  it('assistant text → text event + usage', () => {
    const ev = parseTranscriptLine(L(5));
    expect(ev).toContainEqual({ kind: 'text', sessionId: 'S1', at: '2026-08-24T07:10:00.000Z', role: 'assistant', text: 'Found the casMigration folder; the Jenkinsfile lives under jenkins/.' });
    expect(ev).toContainEqual({ kind: 'usage', sessionId: 'S1', at: '2026-08-24T07:10:00.000Z', input: 3, output: 120, cacheRead: 200 });
  });
  it('system record → nothing', () => { expect(parseTranscriptLine(L(6))).toEqual([]); });
  it('truncated line → nothing, no throw', () => { expect(parseTranscriptLine(L(7))).toEqual([]); });
  it('blank line → nothing', () => { expect(parseTranscriptLine('')).toEqual([]); });
  it('gitBranch "HEAD" is not reported as a branch', () => {
    expect(parseTranscriptLine(L(5)).some((e) => e.kind === 'branch')).toBe(false);
  });
});
