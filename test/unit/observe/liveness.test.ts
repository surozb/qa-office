import { describe, it, expect } from 'vitest';
import { reapSessions, type ProcessProbe } from '../../../src/main/observe/liveness';
import type { SessionRecord } from '../../../src/shared/types';

const rec = (pid: number, procStart: string): SessionRecord => ({
  pid, procStart, sessionId: `s${pid}`, cwd: 'C:\\x', name: `n${pid}`, status: 'idle', kind: 'interactive', startedAt: 0, updatedAt: 0,
});
const fakeProbe = (table: Record<number, string | null>): ProcessProbe => ({ startFileTime: async (pid) => table[pid] ?? null });

describe('reapSessions', () => {
  it('keeps sessions whose pid is alive with matching start time', async () => {
    const r = await reapSessions([rec(10, '111')], fakeProbe({ 10: '111' }));
    expect(r.live.map((s) => s.pid)).toEqual([10]); expect(r.dead).toEqual([]);
  });
  it('reaps a dead pid', async () => {
    const r = await reapSessions([rec(10, '111')], fakeProbe({}));
    expect(r.live).toEqual([]); expect(r.dead.map((s) => s.pid)).toEqual([10]);
  });
  it('reaps a reused pid (start time mismatch)', async () => {
    const r = await reapSessions([rec(10, '111')], fakeProbe({ 10: '999' }));
    expect(r.dead.map((s) => s.pid)).toEqual([10]);
  });
  it('treats a probe failure as dead, not as an exception', async () => {
    const probe: ProcessProbe = { startFileTime: async () => { throw new Error('pwsh exploded'); } };
    expect((await reapSessions([rec(10, '111')], probe)).dead).toHaveLength(1);
  });
});
