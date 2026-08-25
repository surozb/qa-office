export const ROOM_W = 300, ROOM_H = 190, GAP = 16, PAD = 16;
export interface Rect { x: number; y: number; w: number; h: number }
export function roomRect(grid: { col: number; row: number }): Rect {
  return { x: PAD + grid.col * (ROOM_W + GAP), y: PAD + grid.row * (ROOM_H + GAP), w: ROOM_W, h: ROOM_H };
}
export function seatPosition(room: Rect, index: number): { x: number; y: number } {
  const col = index % 3, row = Math.floor(index / 3);
  return { x: room.x + 36 + col * 44, y: room.y + 64 + row * 40 };
}
