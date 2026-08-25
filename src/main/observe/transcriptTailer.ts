import { EventEmitter } from 'node:events';
import { open, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import { parseTranscriptLine } from './transcriptParser';
import type { ActivityEvent } from '../../shared/types';

export class TranscriptTailer extends EventEmitter {
  private readonly file: string; private readonly fromStart: boolean;
  private offset = 0; private carry = ''; private watcher?: FSWatcher; private reading = false; private pending = false;

  constructor(opts: { file: string; fromStart?: boolean }) { super(); this.file = opts.file; this.fromStart = opts.fromStart ?? false; }

  async start(): Promise<void> {
    if (!this.fromStart) { try { this.offset = (await stat(this.file)).size; } catch { this.offset = 0; } }
    else await this.read();
    // watch the directory so a not-yet-existing file is picked up when created
    this.watcher = chokidar.watch(dirname(this.file), { ignoreInitial: true, depth: 0 });
    this.watcher.on('all', (_ev, p) => { if (p === this.file) void this.read(); });
    // wait for watcher to be ready
    await new Promise<void>((resolve) => this.watcher!.once('ready', resolve));
  }

  async stop(): Promise<void> { await this.watcher?.close(); }

  private async read(): Promise<void> {
    if (this.reading) { this.pending = true; return; }
    this.reading = true;
    try {
      let size: number; try { size = (await stat(this.file)).size; } catch { return; }
      if (size < this.offset) { this.offset = 0; this.carry = ''; }        // truncated/rotated
      if (size === this.offset) return;
      const fh = await open(this.file, 'r');
      try {
        const buf = Buffer.alloc(size - this.offset);
        const { bytesRead } = await fh.read(buf, 0, buf.length, this.offset);
        this.offset += bytesRead;
        const text = this.carry + buf.subarray(0, bytesRead).toString('utf8');
        const parts = text.split('\n');
        this.carry = parts.pop() ?? '';                                        // last piece has no newline yet
        const events: ActivityEvent[] = [];
        for (const line of parts) events.push(...parseTranscriptLine(line.replace(/\r$/, '')));
        if (events.length) this.emit('events', events);
      } finally { await fh.close(); }
    } finally {
      this.reading = false;
      if (this.pending) { this.pending = false; void this.read(); }
    }
  }
}
