import { Roster } from '../src/core/roster'

test('add 返回递增 id，达到上限后返回 null', () => {
  const r = new Roster<string>(2)
  const a = r.add('a')
  const b = r.add('b')
  expect(a).toBe(0)
  expect(b).toBe(1)
  expect(r.size).toBe(2)
  expect(r.add('c')).toBeNull()
  expect(r.size).toBe(2)
})

test('remove 后可再 add', () => {
  const r = new Roster<string>(1)
  const a = r.add('a')!
  expect(r.add('b')).toBeNull()
  r.remove(a)
  expect(r.size).toBe(0)
  expect(r.add('b')).toBe(1) // id 不复用被移除的 0（失败的 add 不占号）
})

test('entries 与 clear', () => {
  const r = new Roster<number>(5)
  r.add(10)
  r.add(20)
  expect(r.entries().map(([, v]) => v)).toEqual([10, 20])
  r.clear()
  expect(r.size).toBe(0)
})
