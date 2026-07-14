export interface Rect { x: number; y: number; w: number; h: number }

export function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
}

export function pointInCircle(px: number, py: number, cx: number, cy: number, radius: number): boolean {
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy <= radius * radius
}
