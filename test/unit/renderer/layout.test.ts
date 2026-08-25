import { describe, it, expect } from 'vitest';
import { roomRect, seatPosition, gridSize, ROOM_W, ROOM_H, GAP, PAD } from '../../../src/renderer/floor/layout';

describe('layout', () => {
  it('places rooms on a grid with gaps', () => {
    expect(roomRect({ col: 0, row: 0 })).toEqual({ x: PAD, y: PAD, w: ROOM_W, h: ROOM_H });
    expect(roomRect({ col: 2, row: 1 })).toEqual({ x: PAD + 2 * (ROOM_W + GAP), y: PAD + (ROOM_H + GAP), w: ROOM_W, h: ROOM_H });
  });
  it('seats occupants three per row inside the room', () => {
    const r = roomRect({ col: 0, row: 0 });
    const a = seatPosition(r, 0), b = seatPosition(r, 1), d = seatPosition(r, 3);
    expect(b.x - a.x).toBe(44); expect(b.y).toBe(a.y);
    expect(d.x).toBe(a.x); expect(d.y - a.y).toBe(40);
    expect(d.x).toBeGreaterThan(r.x); expect(d.y).toBeLessThan(r.y + r.h);
  });
  it('computes grid size for a 4x3 layout', () => {
    const stations = [
      { grid: { col: 0, row: 0 } },
      { grid: { col: 1, row: 0 } },
      { grid: { col: 2, row: 0 } },
      { grid: { col: 3, row: 0 } },
      { grid: { col: 0, row: 1 } },
      { grid: { col: 1, row: 1 } },
      { grid: { col: 2, row: 1 } },
      { grid: { col: 3, row: 1 } },
      { grid: { col: 0, row: 2 } },
      { grid: { col: 1, row: 2 } },
      { grid: { col: 2, row: 2 } },
      { grid: { col: 3, row: 2 } },
    ] as { grid: { col: number; row: number } }[];
    expect(gridSize(stations)).toEqual({ w: 1280, h: 634 });
  });
  it('returns zero size for empty stations list', () => {
    expect(gridSize([])).toEqual({ w: 0, h: 0 });
  });
});
