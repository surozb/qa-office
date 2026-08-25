import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RegistryWatcher } from '../../../src/main/observe/registryWatcher';
import type { ProcessProbe } from '../../../src/main/observe/liveness';

const rec = (pid: number, name: string, status = 'busy') => JSON.stringify({
  pid, sessionId: `sid-${pid}`, cwd: 'C:\\x', name, status, kind: 'interactive', procStart: `ft${pid}`, startedAt: 1, updatedAt: 1,
});
const alive = new Set<number>();
const probe: ProcessProbe = { startFileTime: async (pid) => (alive.has(pid) ? `ft${pid}` : null) };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let dir: string; let w: RegistryWatcher;
afterEach(async () => { await w?.stop(); rmSync(dir, { recursive: true, force: true }); alive.clear(); });

describe('RegistryWatcher', () => {
  it('emits upsert for live files present at start and ignores dead ones', async () => {
    dir = mkdtempSync(join(tmpdir(), 'reg-'));
    writeFileSync(join(dir, '1.json'), rec(1, 'one')); writeFileSync(join(dir, '2.json'), rec(2, 'two'));
    alive.add(1);
    w = new RegistryWatcher({ dir, probe, pollMs: 200 });
    const ups: string[] = []; w.on('upsert', (r) => ups.push(r.name));
    await w.start();
    expect(ups).toEqual(['one']); expect(w.snapshot().map((r) => r.pid)).toEqual([1]);
  });
  it('emits gone when a process dies even though its file remains', async () => {
    dir = mkdtempSync(join(tmpdir(), 'reg-'));
    writeFileSync(join(dir, '1.json'), rec(1, 'one')); alive.add(1);
    w = new RegistryWatcher({ dir, probe, pollMs: 150 });
    const gone: number[] = []; w.on('gone', (r) => gone.push(r.pid));
    await w.start(); alive.delete(1); await wait(500);
    expect(gone).toEqual([1]); expect(w.snapshot()).toEqual([]);
  });
  it('emits upsert on status change of a live session', async () => {
    dir = mkdtempSync(join(tmpdir(), 'reg-'));
    writeFileSync(join(dir, '1.json'), rec(1, 'one')); alive.add(1);
    w = new RegistryWatcher({ dir, probe, pollMs: 150 });
    const statuses: string[] = []; w.on('upsert', (r) => statuses.push(r.status));
    await w.start(); writeFileSync(join(dir, '1.json'), rec(1, 'one', 'idle')); await wait(500);
    expect(statuses).toEqual(['busy', 'idle']);
  });
  it('does not emit upsert twice for identical content', async () => {
    dir = mkdtempSync(join(tmpdir(), 'reg-'));
    writeFileSync(join(dir, '1.json'), rec(1, 'one')); alive.add(1);
    w = new RegistryWatcher({ dir, probe, pollMs: 100 });
    let n = 0; w.on('upsert', () => n++);
    await w.start(); await wait(450);
    expect(n).toBe(1);
  });
});
