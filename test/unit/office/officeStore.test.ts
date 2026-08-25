import { describe, it, expect } from 'vitest';
import { OfficeStore } from '../../../src/main/office/officeStore';
import type { OfficeConfig, SessionRecord } from '../../../src/shared/types';

const cfg: OfficeConfig = {
  lobbyId: 'lobby', defaultStationByCwd: { 'C:\\A\\repo': 'lab' },
  stations: [
    { id: 'design', name: 'Design', grid: { col: 0, row: 0 }, cwds: ['C:\\A\\repo'], skills: ['write-test-case'] },
    { id: 'lab', name: 'Lab', grid: { col: 1, row: 0 }, cwds: ['C:\\A\\repo'], skills: [] },
    { id: 'lobby', name: 'Lobby', grid: { col: 0, row: 1 }, cwds: [], skills: [] },
  ],
};
const sess = (pid: number, cwd = 'C:\\A\\repo'): SessionRecord => ({
  pid, sessionId: `s${pid}`, cwd, name: `n${pid}`, status: 'busy', kind: 'interactive', procStart: 'x', startedAt: 0, updatedAt: 0,
});
const mk = () => new OfficeStore(cfg, { now: () => '2026-08-25T10:00:00.000Z' });

describe('OfficeStore', () => {
  it('places a new session and logs the join', () => {
    const st = mk(); st.upsertSession(sess(1));
    const s = st.state();
    expect(s.occupants).toHaveLength(1);
    expect(s.occupants[0]).toMatchObject({ sessionId: 's1', stationId: 'lab', status: 'busy', origin: 'walkin', tokens: { input: 0, output: 0, cacheRead: 0 } });
    expect(s.log.at(-1)?.text).toBe('● joined Lab');
  });
  it('unknown cwd lands in the lobby', () => { const st = mk(); st.upsertSession(sess(2, 'Z:\\q')); expect(st.state().occupants[0]?.stationId).toBe('lobby'); });
  it('tool event sets current tool + emote and logs', () => {
    const st = mk(); st.upsertSession(sess(1));
    st.applyEvents([{ kind: 'tool', sessionId: 's1', at: 't', tool: 'Grep', emote: 'search', summary: 'data-testid' }]);
    expect(st.state().occupants[0]).toMatchObject({ currentTool: 'Grep', emote: 'search' });
    expect(st.state().log.at(-1)?.text).toBe('▸ Grep  data-testid');
  });
  it('usage accumulates', () => {
    const st = mk(); st.upsertSession(sess(1));
    st.applyEvents([{ kind: 'usage', sessionId: 's1', at: 't', input: 2, output: 10, cacheRead: 100 }, { kind: 'usage', sessionId: 's1', at: 't', input: 3, output: 5, cacheRead: 50 }]);
    expect(st.state().occupants[0]?.tokens).toEqual({ input: 5, output: 15, cacheRead: 150 });
  });
  it('skill event re-places the occupant', () => {
    const st = mk(); st.upsertSession(sess(1));
    st.applyEvents([{ kind: 'skill', sessionId: 's1', at: 't', skill: 'write-test-case' }]);
    expect(st.state().occupants[0]).toMatchObject({ stationId: 'design', lastSkill: 'write-test-case' });
  });
  it('title and branch are recorded', () => {
    const st = mk(); st.upsertSession(sess(1));
    st.applyEvents([{ kind: 'title', sessionId: 's1', title: 'CAS tests' }, { kind: 'branch', sessionId: 's1', branch: 'test/x' }]);
    expect(st.state().occupants[0]).toMatchObject({ title: 'CAS tests', branch: 'test/x' });
  });
  it('events for unknown sessions are ignored', () => {
    const st = mk(); st.applyEvents([{ kind: 'title', sessionId: 'ghost', title: 'x' }]); expect(st.state().occupants).toEqual([]);
  });
  it('gone marks then removeGone drops', () => {
    let t = 0; const st = new OfficeStore(cfg, { now: () => new Date(t).toISOString() });
    st.upsertSession(sess(1)); st.sessionGone(sess(1));
    expect(st.state().occupants[0]?.status).toBe('gone'); expect(st.state().log.at(-1)?.text).toBe('○ left');
    t = 10_000; st.removeGone(5_000); expect(st.state().occupants).toEqual([]);
  });
  it('setConfig re-places everyone', () => {
    const st = mk(); st.upsertSession(sess(2, 'Z:\\q'));
    st.setConfig({ ...cfg, stations: cfg.stations.map((s) => (s.id === 'lab' ? { ...s, cwds: [...s.cwds, 'Z:\\q'] } : s)) });
    expect(st.state().occupants[0]?.stationId).toBe('lab');
  });
  it('log is capped', () => {
    const st = new OfficeStore(cfg, { maxLog: 3 }); st.upsertSession(sess(1));
    for (let i = 0; i < 5; i++) st.applyEvents([{ kind: 'tool', sessionId: 's1', at: 't', tool: 'Read', emote: 'read', summary: `f${i}` }]);
    expect(st.state().log).toHaveLength(3); expect(st.state().log.at(-1)?.text).toBe('▸ Read  f4');
  });
});
