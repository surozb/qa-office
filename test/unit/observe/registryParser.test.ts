import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSessionFile } from '../../../src/main/observe/registryParser';

const fx = (n: string) => readFileSync(join(__dirname, '../../fixtures/sessions', n), 'utf8');

describe('parseSessionFile', () => {
  it('parses a live busy session', () => {
    expect(parseSessionFile(fx('live-busy.json'))).toEqual({
      pid: 22920, sessionId: 'c7b16729-09da-4724-828b-8918c8ad094c', cwd: 'C:\\careerGrowth',
      name: 'careergrowth-9c', status: 'busy', kind: 'interactive',
      procStart: '134320183121973136', startedAt: 1787544714812, updatedAt: 1787566523439,
    });
  });
  it('parses idle status', () => { expect(parseSessionFile(fx('live-idle.json'))?.status).toBe('idle'); });
  it('never exposes messagingSocketPath', () => {
    expect(JSON.stringify(parseSessionFile(fx('live-busy.json')))).not.toContain('pipe');
  });
  it('returns null for truncated JSON', () => { expect(parseSessionFile(fx('malformed.json'))).toBeNull(); });
  it('returns null when required fields are missing', () => {
    expect(parseSessionFile(JSON.stringify({ pid: 5, cwd: 'C:\\x' }))).toBeNull();
  });
  it('falls back to sessionId prefix when name is absent', () => {
    const j = JSON.parse(fx('live-busy.json')); delete j.name;
    expect(parseSessionFile(JSON.stringify(j))?.name).toBe('c7b16729');
  });
});
