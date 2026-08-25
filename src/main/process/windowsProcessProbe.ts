import { execFile } from 'node:child_process';
import type { ProcessProbe } from '../observe/liveness';

/** One PowerShell call per TTL window; answers every pid from that snapshot. */
export class WindowsProcessProbe implements ProcessProbe {
  private cache = new Map<number, string>();
  private cacheAt = 0;
  private inflight: Promise<void> | null = null;
  constructor(private readonly ttlMs = 1500) {}

  async startFileTime(pid: number): Promise<string | null> {
    if (Date.now() - this.cacheAt > this.ttlMs) {
      this.inflight ??= this.refresh().finally(() => { this.inflight = null; });
      await this.inflight;
    }
    return this.cache.get(pid) ?? null;
  }

  private refresh(): Promise<void> {
    const script = 'Get-Process | ForEach-Object { try { "$($_.Id),$($_.StartTime.ToFileTime())" } catch {} }';
    return new Promise((resolve) => {
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
        { windowsHide: true, timeout: 5000, maxBuffer: 4 * 1024 * 1024 },
        (err, stdout) => {
          if (!err) {
            const next = new Map<number, string>();
            for (const line of stdout.split(/\r?\n/)) {
              const [pid, ft] = line.split(',');
              if (pid && ft) next.set(Number(pid), ft.trim());
            }
            this.cache = next;
          }
          this.cacheAt = Date.now(); resolve();
        });
    });
  }
}
