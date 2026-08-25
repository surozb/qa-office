export const ROOM_W = 300, ROOM_H = 190, GAP = 16, PAD = 16;
export interface Rect { x: number; y: number; w: number; h: number }
export function roomRect(grid: { col: number; row: number }): Rect {
  return { x: PAD + grid.col * (ROOM_W + GAP), y: PAD + grid.row * (ROOM_H + GAP), w: ROOM_W, h: ROOM_H };
}
export function seatPosition(room: Rect, index: number): { x: number; y: number } {
  const col = index % 3, row = Math.floor(index / 3);
  return { x: room.x + 36 + col * 44, y: room.y + 64 + row * 40 };
}
export function gridSize(stations: { grid: { col: number; row: number } }[]): { w: number; h: number } {
  if (stations.length === 0) return { w: 0, h: 0 };
  let maxCol = 0, maxRow = 0;
  for (const s of stations) {
    maxCol = Math.max(maxCol, s.grid.col);
    maxRow = Math.max(maxRow, s.grid.row);
  }
  return { w: PAD * 2 + (maxCol + 1) * ROOM_W + maxCol * GAP, h: PAD * 2 + (maxRow + 1) * ROOM_H + maxRow * GAP };
}
