import { pointInRect, pointInCircle } from '../src/core/geometry'

test('pointInRect', () => {
  const r = { x: 10, y: 10, w: 100, h: 50 }
  expect(pointInRect(50, 30, r)).toBe(true)
  expect(pointInRect(10, 10, r)).toBe(true) // 边界包含
  expect(pointInRect(5, 30, r)).toBe(false)
  expect(pointInRect(50, 61, r)).toBe(false)
})

test('pointInCircle', () => {
  expect(pointInCircle(100, 100, 100, 100, 20)).toBe(true)
  expect(pointInCircle(115, 100, 100, 100, 20)).toBe(true)
  expect(pointInCircle(125, 100, 100, 100, 20)).toBe(false)
})
