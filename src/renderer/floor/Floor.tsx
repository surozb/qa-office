import { useCallback, useEffect, useRef } from 'react';
import { Application, Container, FederatedPointerEvent } from 'pixi.js';
import { useOffice } from '../store';
import { RoomLayer } from './RoomLayer';
import { SpriteLayer } from './SpriteLayer';

export function Floor() {
  const host = useRef<HTMLDivElement>(null);
  const select = useOffice((u) => u.select);
  const refs = useRef<{ app: Application; world: Container; rooms: RoomLayer; sprites: SpriteLayer } | null>(null);

  const draw = useCallback(() => {
    const r = refs.current; if (!r) return;
    const u = useOffice.getState();
    if (!u.state) return;
    const counts = new Map<string, number>();
    for (const o of u.state.occupants) counts.set(o.stationId, (counts.get(o.stationId) ?? 0) + 1);
    const selStation = u.selected?.startsWith('station:') ? u.selected.slice(8) : null;
    const selOcc = u.selected?.startsWith('occupant:') ? u.selected.slice(9) : null;
    r.rooms.render(u.state.stations, counts, selStation);
    r.sprites.render(u.state.stations, u.state.occupants, selOcc);
  }, []);

  useEffect(() => {
    let disposed = false;
    (async () => {
      const app = new Application();
      await app.init({ background: '#13151d', resizeTo: host.current!, antialias: false, resolution: window.devicePixelRatio });
      if (disposed) { app.destroy(); return; }
      host.current!.appendChild(app.canvas);
      const world = new Container(); const rooms = new RoomLayer(); const sprites = new SpriteLayer();
      world.addChild(rooms, sprites); app.stage.addChild(world);
      app.stage.eventMode = 'static'; app.stage.hitArea = app.screen;
      app.stage.on('pointertap', (e: FederatedPointerEvent) => {
        let t: Container | null = e.target as Container;
        while (t && !t.label?.startsWith('occupant:') && !t.label?.startsWith('station:')) t = t.parent;
        select(t?.label ?? null);
      });
      app.ticker.add((tk) => {
        sprites.tick(tk.deltaTime);
        const u = useOffice.getState();
        if (u.follow && u.selected?.startsWith('occupant:')) {
          const p = sprites.positionOf(u.selected.slice(9));
          if (p) { world.position.x += (app.screen.width / 2 - p.x - world.position.x) * 0.1; world.position.y += (app.screen.height / 2 - p.y - world.position.y) * 0.1; }
        } else { world.position.x += (0 - world.position.x) * 0.1; world.position.y += (0 - world.position.y) * 0.1; }
      });
      refs.current = { app, world, rooms, sprites };
      draw();
    })();
    return () => { disposed = true; refs.current?.app.destroy(true); refs.current = null; };
  }, [select]);

  useEffect(() => {
    const unsubscribe = useOffice.subscribe(() => {
      draw();
    });
    return unsubscribe;
  }, [draw]);

  return <div ref={host} style={{ flex: 1, minWidth: 0, minHeight: 0 }} />;
}
