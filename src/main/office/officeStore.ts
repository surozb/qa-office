import { EventEmitter } from 'node:events';
import { placeOccupant } from './placement';
import type { ActivityEvent, LogLine, Occupant, OfficeConfig, OfficeState, SessionRecord } from '../../shared/types';

export class OfficeStore extends EventEmitter {
  private cfg: OfficeConfig;
  private occ = new Map<string, Occupant>();   // by sessionId
  private log: LogLine[] = [];
  private readonly maxLog: number; private readonly now: () => string;
  private timer?: NodeJS.Timeout;

  constructor(cfg: OfficeConfig, opts: { maxLog?: number; now?: () => string } = {}) {
    super(); this.cfg = cfg; this.maxLog = opts.maxLog ?? 500; this.now = opts.now ?? (() => new Date().toISOString());
  }

  private stationName(id: string): string { return this.cfg.stations.find((s) => s.id === id)?.name ?? id; }
  private push(o: Occupant, text: string): void {
    this.log.push({ at: this.now(), sessionId: o.sessionId, name: o.name, text });
    if (this.log.length > this.maxLog) this.log.splice(0, this.log.length - this.maxLog);
  }
  private changed(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = undefined; this.emit('change', this.state()); }, 100);
  }

  setConfig(cfg: OfficeConfig): void {
    this.cfg = cfg;
    for (const o of this.occ.values()) o.stationId = placeOccupant(o.cwd, o.lastSkill, cfg);
    this.changed();
  }

  upsertSession(r: SessionRecord): void {
    const prev = this.occ.get(r.sessionId);
    if (prev) { prev.status = r.status; prev.name = r.name; prev.lastSeen = this.now(); this.changed(); return; }
    const o: Occupant = {
      sessionId: r.sessionId, name: r.name, pid: r.pid, cwd: r.cwd, status: r.status, origin: 'walkin',
      stationId: placeOccupant(r.cwd, undefined, this.cfg), tokens: { input: 0, output: 0, cacheRead: 0 }, lastSeen: this.now(),
    };
    this.occ.set(o.sessionId, o); this.push(o, `● joined ${this.stationName(o.stationId)}`); this.changed();
  }

  sessionGone(r: SessionRecord): void {
    const o = this.occ.get(r.sessionId); if (!o) return;
    o.status = 'gone'; o.lastSeen = this.now(); this.push(o, '○ left'); this.changed();
  }

  removeGone(olderThanMs: number): void {
    const cutoff = Date.parse(this.now()) - olderThanMs;
    for (const [id, o] of this.occ) if (o.status === 'gone' && Date.parse(o.lastSeen) < cutoff) this.occ.delete(id);
    this.changed();
  }

  applyEvents(events: ActivityEvent[]): void {
    for (const e of events) {
      const o = this.occ.get(e.sessionId); if (!o) continue;
      switch (e.kind) {
        case 'tool': o.currentTool = e.tool; o.emote = e.emote; o.lastSeen = this.now(); this.push(o, `▸ ${e.tool}  ${e.summary}`); break;
        case 'skill': o.lastSkill = e.skill; o.stationId = placeOccupant(o.cwd, e.skill, this.cfg); this.push(o, `⚑ skill ${e.skill}`); break;
        case 'usage': o.tokens = { input: o.tokens.input + e.input, output: o.tokens.output + e.output, cacheRead: o.tokens.cacheRead + e.cacheRead }; break;
        case 'title': o.title = e.title; this.push(o, `✎ titled: ${e.title}`); break;
        case 'branch': o.branch = e.branch; break;
        case 'text': o.lastSeen = this.now(); break;
      }
    }
    if (events.length) this.changed();
  }

  state(): OfficeState {
    return { stations: this.cfg.stations, lobbyId: this.cfg.lobbyId, occupants: [...this.occ.values()].map((o) => ({ ...o, tokens: { ...o.tokens } })), log: [...this.log], generatedAt: this.now() };
  }
}
