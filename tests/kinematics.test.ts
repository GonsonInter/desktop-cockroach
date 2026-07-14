import { spawnState, stepState, isOffscreen, SPEED_MIN, SPEED_MAX } from '../src/core/kinematics'

// 固定序列 rng，可预测
function seqRng(values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

test('spawnState 从 walk 态起步，位置在 origin，速度/朝向在范围内', () => {
  const s = spawnState({ x: 100, y: 200 }, seqRng([0.5]))
  expect(s.x).toBe(100)
  expect(s.y).toBe(200)
  expect(s.mode).toBe('walk')
  expect(s.speed).toBeGreaterThanOrEqual(SPEED_MIN)
  expect(s.speed).toBeLessThanOrEqual(SPEED_MAX)
  expect(s.heading).toBeGreaterThanOrEqual(0)
  expect(s.heading).toBeLessThan(Math.PI * 2)
  expect(s.phaseTimer).toBeGreaterThan(0)
})

test('stepState 未到决策点时按 speed*dt 沿 heading 前进', () => {
  const s = { x: 0, y: 0, heading: 0, speed: 100, phaseTimer: 999, mode: 'walk' as const }
  const n = stepState(s, 0.1, seqRng([0.5]))
  expect(n.x).toBeCloseTo(10, 5)
  expect(n.y).toBeCloseTo(0, 5)
  expect(n.mode).toBe('walk')
  expect(s.x).toBe(0) // 不改入参
})

test('行走决策点：中概率进入停顿，速度归零', () => {
  const s = { x: 5, y: 5, heading: 0, speed: 100, phaseTimer: 0.05, mode: 'walk' as const }
  const n = stepState(s, 0.1, seqRng([0.1, 0.5])) // roll=0.1 落在 pause 区间
  expect(n.mode).toBe('pause')
  expect(n.speed).toBe(0)
  expect(n.x).toBe(5) // 停顿不移动
})

test('行走决策点：小概率起飞，速度远高于爬行', () => {
  const s = { x: 0, y: 0, heading: 0, speed: 100, phaseTimer: 0.05, mode: 'walk' as const }
  const n = stepState(s, 0.1, seqRng([0.01, 0.5, 0.5, 0.5])) // roll=0.01 起飞
  expect(n.mode).toBe('fly')
  expect(n.speed).toBeGreaterThan(SPEED_MAX)
})

test('停顿/飞行结束后恢复行走', () => {
  const s = { x: 0, y: 0, heading: 0, speed: 0, phaseTimer: 0, mode: 'pause' as const }
  const n = stepState(s, 0.1, seqRng([0.5, 0.5, 0.5]))
  expect(n.mode).toBe('walk')
  expect(n.speed).toBeGreaterThanOrEqual(SPEED_MIN)
  expect(n.speed).toBeLessThanOrEqual(SPEED_MAX)
})

test('isOffscreen 中心越过边界+margin 时为真', () => {
  const b = { width: 800, height: 600 }
  const base = { heading: 0, speed: 0, phaseTimer: 0, mode: 'walk' as const }
  expect(isOffscreen({ x: -60, y: 300, ...base }, b, 50)).toBe(true)
  expect(isOffscreen({ x: 400, y: 300, ...base }, b, 50)).toBe(false)
  expect(isOffscreen({ x: 861, y: 300, ...base }, b, 50)).toBe(true)
})
