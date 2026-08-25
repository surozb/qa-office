import { EventEmitter } from 'node:events';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import { parseSessionFile } from './registryParser';
import { reapSessions, type ProcessProbe } from './liveness';
import type { SessionRecord } from '../../shared/types';

export class RegistryWatcher extends EventEmitter {
  private readonly dir: string; private readonly probe: ProcessProbe; private readonly pollMs: number;
  private live = new Map<number, SessionRecord>();
  private watcher?: FSWatcher; private timer?: NodeJS.Timeout; private scanning = false;

  constructor(opts: { dir: string; probe: ProcessProbe; pollMs?: number }) {
    super(); this.dir = opts.dir; this.probe = opts.probe; this.pollMs = opts.pollMs ?? 2000;
  }

  snapshot(): SessionRecord[] { return [...this.live.values()]; }

  async start(): Promise<void> {
    await this.scan();
    this.watcher = chokidar.watch(this.dir, { ignoreInitial: true, depth: 0 });
    this.watcher.on('all', () => { void this.scan(); });
    this.timer = setInterval(() => { void this.scan(); }, this.pollMs);
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.watcher?.close();
  }

  private async scan(): Promise<void> {
    if (this.scanning) return; this.scanning = true;
    try {
      let names: string[] = [];
      try { names = (await readdir(this.dir)).filter((n) => n.endsWith('.json')); } catch { names = []; }
      const parsed: SessionRecord[] = [];
      for (const n of names) {
        try { const r = parseSessionFile(await readFile(join(this.dir, n), 'utf8')); if (r) parsed.push(r); }
        catch { /* mid-write or vanished; next scan */ }
      }
      const { live } = await reapSessions(parsed, this.probe);
      const seen = new Set<number>();
      for (const r of live) {
        seen.add(r.pid);
        const prev = this.live.get(r.pid);
        if (!prev || JSON.stringify(prev) !== JSON.stringify(r)) { this.live.set(r.pid, r); this.emit('upsert', r); }
      }
      for (const [pid, r] of this.live) if (!seen.has(pid)) { this.live.delete(pid); this.emit('gone', r); }
    } finally { this.scanning = false; }
  }
}
