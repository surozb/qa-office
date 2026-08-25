import { Container, Graphics, Text } from 'pixi.js';
import { roomRect } from './layout';
import type { Station } from '../../shared/types';

const C = { room: 0x232838, border: 0x39415a, grid: 0x2b3147, text: 0xe9e7dc, dim: 0x6b7390, selected: 0xffb454 };

export class RoomLayer extends Container {
  private drawn = new Map<string, Container>();

  render(stations: Station[], counts: Map<string, number>, selectedStation: string | null): void {
    this.removeChildren(); this.drawn.clear();
    for (const s of stations) {
      const r = roomRect(s.grid); const c = new Container(); c.position.set(r.x, r.y);
      const g = new Graphics();
      g.rect(0, 0, r.w, r.h).fill(C.room).stroke({ width: 2, color: s.id === selectedStation ? C.selected : C.border });
      for (let x = 26; x < r.w; x += 26) g.moveTo(x, 34).lineTo(x, r.h).stroke({ width: 1, color: C.grid });
      for (let y = 34; y < r.h; y += 26) g.moveTo(0, y).lineTo(r.w, y).stroke({ width: 1, color: C.grid });
      c.addChild(g);
      const name = new Text({ text: s.name, style: { fontFamily: 'Consolas, monospace', fontSize: 15, fontWeight: '700', fill: C.text } });
      name.position.set(12, 8); c.addChild(name);
      const n = counts.get(s.id) ?? 0;
      const count = new Text({ text: n ? `${n} in room` : 'empty', style: { fontFamily: 'Consolas, monospace', fontSize: 10, fill: C.dim } });
      count.anchor.set(1, 0); count.position.set(r.w - 10, 10); c.addChild(count);
      c.eventMode = 'static'; c.cursor = 'pointer'; c.label = `station:${s.id}`;
      this.addChild(c); this.drawn.set(s.id, c);
    }
  }
}
