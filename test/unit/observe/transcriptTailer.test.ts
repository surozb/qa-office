import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TranscriptTailer } from '../../../src/main/observe/transcriptTailer';
import type { ActivityEvent } from '../../../src/shared/types';

const title = (t: string) => JSON.stringify({ type: 'ai-title', sessionId: 'S', aiTitle: t });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let dir: string; let t: TranscriptTailer;
afterEach(async () => { await t?.stop(); rmSync(dir, { recursive: true, force: true }); });

describe('TranscriptTailer', () => {
  it('fromStart reads existing lines', async () => {
    dir = mkdtempSync(join(tmpdir(), 'tail-')); const f = join(dir, 'a.jsonl');
    writeFileSync(f, title('one') + '\n' + title('two') + '\n');
    t = new TranscriptTailer({ file: f, fromStart: true });
    const got: ActivityEvent[] = []; t.on('events', (e) => got.push(...e));
    await t.start();
    expect(got.map((e) => e.kind === 'title' && e.title)).toEqual(['one', 'two']);
  });
  it('default skips existing lines and emits only appended ones', async () => {
    dir = mkdtempSync(join(tmpdir(), 'tail-')); const f = join(dir, 'a.jsonl');
    writeFileSync(f, title('old') + '\n');
    t = new TranscriptTailer({ file: f });
    const got: ActivityEvent[] = []; t.on('events', (e) => got.push(...e));
    await t.start(); appendFileSync(f, title('new') + '\n'); await wait(400);
    expect(got.map((e) => e.kind === 'title' && e.title)).toEqual(['new']);
  });
  it('holds a partial line until its newline arrives', async () => {
    dir = mkdtempSync(join(tmpdir(), 'tail-')); const f = join(dir, 'a.jsonl');
    writeFileSync(f, '');
    t = new TranscriptTailer({ file: f });
    const got: ActivityEvent[] = []; t.on('events', (e) => got.push(...e));
    await t.start();
    const full = title('split'); appendFileSync(f, full.slice(0, 20)); await wait(300);
    expect(got).toEqual([]);
    appendFileSync(f, full.slice(20) + '\n'); await wait(400);
    expect(got.map((e) => e.kind === 'title' && e.title)).toEqual(['split']);
  });
  it('tolerates a file that does not exist yet', async () => {
    dir = mkdtempSync(join(tmpdir(), 'tail-')); const f = join(dir, 'later.jsonl');
    t = new TranscriptTailer({ file: f });
    const got: ActivityEvent[] = []; t.on('events', (e) => got.push(...e));
    await t.start(); writeFileSync(f, title('born') + '\n'); await wait(500);
    expect(got.map((e) => e.kind === 'title' && e.title)).toEqual(['born']);
  });
});
