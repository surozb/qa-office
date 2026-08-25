import { homedir } from 'node:os';
import { join } from 'node:path';
import { open, stat } from 'node:fs/promises';
import { RegistryWatcher } from './observe/registryWatcher';
import { TranscriptTailer } from './observe/transcriptTailer';
import { transcriptPath } from './observe/transcriptLocator';
import { parseTranscriptLine } from './observe/transcriptParser';
import { WindowsProcessProbe } from './process/windowsProcessProbe';
import { OfficeStore } from './office/officeStore';
import { loadConfig, saveConfig } from './office/config';
import { assignFolder } from './office/placement';
import type { OfficeState, SessionRecord } from '../shared/types';

const TAIL_BYTES = 64 * 1024;

/** Read the last ≤64 KB of a transcript once, keeping only title/branch/skill events (cheap warm start). */
async function readTail(file: string): Promise<ReturnType<typeof parseTranscriptLine>> {
  try {
    const size = (await stat(file)).size; const from = Math.max(0, size - TAIL_BYTES);
    const fh = await open(file, 'r');
    try {
      const buf = Buffer.alloc(size - from); const { bytesRead } = await fh.read(buf, 0, buf.length, from);
      const lines = buf.subarray(0, bytesRead).toString('utf8').split('\n'); if (from > 0) lines.shift();
      return lines.flatMap((l) => parseTranscriptLine(l)).filter((e) => e.kind === 'title' || e.kind === 'branch' || e.kind === 'skill');
    } finally { await fh.close(); }
  } catch { return []; }
}

export class Observatory {
  readonly claudeHome = join(homedir(), '.claude');
  readonly store: OfficeStore;
  private readonly configFile: string;
  private readonly registry: RegistryWatcher;
  private tailers = new Map<string, TranscriptTailer>();
  private reaper?: NodeJS.Timeout;

  constructor(configFile: string) {
    this.configFile = configFile;
    this.store = new OfficeStore(loadConfig(configFile));
    this.registry = new RegistryWatcher({ dir: join(this.claudeHome, 'sessions'), probe: new WindowsProcessProbe(), pollMs: 2000 });
    this.registry.on('upsert', (r: SessionRecord) => { this.store.upsertSession(r); void this.ensureTailer(r); });
    this.registry.on('gone', (r: SessionRecord) => { this.store.sessionGone(r); void this.dropTailer(r.sessionId); });
  }

  async start(): Promise<void> {
    await this.registry.start();
    this.reaper = setInterval(() => this.store.removeGone(60_000), 10_000);
  }

  async stop(): Promise<void> {
    if (this.reaper) clearInterval(this.reaper);
    await this.registry.stop();
    await Promise.all([...this.tailers.values()].map((t) => t.stop()));
  }

  state(): OfficeState { return this.store.state(); }

  assignFolder(cwd: string, stationId: string): void {
    const next = assignFolder(loadConfig(this.configFile), cwd, stationId);
    saveConfig(this.configFile, next);
    this.store.setConfig(next);
  }

  private async ensureTailer(r: SessionRecord): Promise<void> {
    if (this.tailers.has(r.sessionId)) return;
    const file = transcriptPath(this.claudeHome, r.cwd, r.sessionId);
    const t = new TranscriptTailer({ file, fromStart: false });
    this.tailers.set(r.sessionId, t);
    t.on('events', (ev) => this.store.applyEvents(ev));
    this.store.applyEvents(await readTail(file));
    await t.start();
  }

  private async dropTailer(sessionId: string): Promise<void> {
    const t = this.tailers.get(sessionId); if (!t) return;
    this.tailers.delete(sessionId); await t.stop();
  }
}
