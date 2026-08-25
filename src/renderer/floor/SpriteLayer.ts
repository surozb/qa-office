import { Container, Graphics, Text } from 'pixi.js';
import { roomRect, seatPosition } from './layout';
import type { Emote, Occupant, Station } from '../../shared/types';

const EMOTE: Record<Emote, string> = { search: '🔍', read: '📖', edit: '✏️', shell: '⌨', browser: '🌐', skill: '⚑', delegate: '👥', think: '…', other: '⋯' };
const STATUS = { busy: 0xffb454, idle: 0x7dd98f, gone: 0x6b7390 } as const;

class Sprite extends Container {
  target = { x: 0, y: 0 };
  private dot = new Graphics(); private bubble = new Text({ text: '', style: { fontSize: 12 } });
  private tag: Text;
  constructor(readonly sessionId: string, name: string) {
    super();
    const body = new Graphics();
    body.rect(5, -2, 16, 6).fill(0x3a2a1a);                         // hair
    body.rect(6, 0, 14, 12).fill(0xe8c39a).stroke({ width: 1.5, color: 0x1a1208 });   // head
    body.rect(4, 12, 18, 14).fill(0x4a5068).stroke({ width: 1.5, color: 0x10131c });  // body (walk-in tint)
    body.rect(7, 26, 5, 7).fill(0x2a2f42); body.rect(14, 26, 5, 7).fill(0x2a2f42);     // legs
    this.addChild(body);
    this.tag = new Text({ text: name, style: { fontFamily: 'Consolas, monospace', fontSize: 9, fill: 0x9aa3bd } });
    this.tag.anchor.set(0.5, 1); this.tag.position.set(13, -6); this.addChild(this.tag);
    this.dot.position.set(24, -2); this.addChild(this.dot);
    this.bubble.anchor.set(0, 1); this.bubble.position.set(26, -8); this.addChild(this.bubble);
    this.eventMode = 'static'; this.cursor = 'pointer'; this.label = `occupant:${sessionId}`;
  }
  update(o: Occupant, selected: boolean): void {
    this.dot.clear().circle(0, 0, 4).fill(STATUS[o.status]).stroke({ width: 1.5, color: 0x13151d });
    this.bubble.text = o.status === 'busy' && o.emote ? EMOTE[o.emote] : '';
    this.alpha = o.status === 'gone' ? 0.45 : 1;
    this.tag.style.fill = selected ? 0xffb454 : 0x9aa3bd;
  }
  tick(dt: number): void {   // ease toward target seat
    this.position.x += (this.target.x - this.position.x) * Math.min(1, dt * 0.08);
    this.position.y += (this.target.y - this.position.y) * Math.min(1, dt * 0.08);
  }
}

export class SpriteLayer extends Container {
  private sprites = new Map<string, Sprite>();
  render(stations: Station[], occupants: Occupant[], selected: string | null): void {
    const byStation = new Map<string, Occupant[]>();
    for (const o of occupants) (byStation.get(o.stationId) ?? byStation.set(o.stationId, []).get(o.stationId)!).push(o);
    const seen = new Set<string>();
    for (const s of stations) {
      const r = roomRect(s.grid);
      (byStation.get(s.id) ?? []).forEach((o, i) => {
        seen.add(o.sessionId);
        let sp = this.sprites.get(o.sessionId);
        const seat = seatPosition(r, i);
        if (!sp) { sp = new Sprite(o.sessionId, o.name); sp.position.set(seat.x, seat.y); this.sprites.set(o.sessionId, sp); this.addChild(sp); }
        sp.target = seat; sp.update(o, o.sessionId === selected);
      });
    }
    for (const [id, sp] of this.sprites) if (!seen.has(id)) { this.removeChild(sp); sp.destroy(); this.sprites.delete(id); }
  }
  tick(dt: number): void { for (const sp of this.sprites.values()) sp.tick(dt); }
  positionOf(sessionId: string): { x: number; y: number } | null { const sp = this.sprites.get(sessionId); return sp ? { x: sp.position.x, y: sp.position.y } : null; }
}
