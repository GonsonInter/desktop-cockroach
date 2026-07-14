export interface Vec { x: number; y: number }
export type RoachMode = 'walk' | 'pause' | 'fly'
export interface RoachState {
  x: number
  y: number
  heading: number // 弧度，前进方向
  speed: number // px/s（停顿时为 0，飞行时很高）
  phaseTimer: number // 秒，当前阶段剩余时间，到点做下一次决策
  mode: RoachMode
  curve?: number // 飞行时的转弯速率（弧度/秒），使飞行带随机弧度；非飞行为 0
  turnTarget?: number // 停顿时的目标朝向（弧度），用于平滑转头过渡
}
export interface Bounds { width: number; height: number }

export const SPEED_MIN = 60
export const SPEED_MAX = 180
const FLY_SPEED_MIN = 340 // 飞行速度远高于爬行
const FLY_SPEED_MAX = 480
const WALK_MIN = 0.4 // 一段行走持续时间（到点重新决策）
const WALK_MAX = 1.6
const PAUSE_MIN = 0.8 // 停顿（发呆动触须）持续时间
const PAUSE_MAX = 2.5
const FLY_MIN = 1.0 // 飞行持续时间（较长距离）
const FLY_MAX = 2.0
const FLY_CHANCE = 0.06 // 行走决策点起飞概率（小概率）
const PAUSE_CHANCE = 0.22 // 行走决策点停顿概率
const MAX_TURN_DELTA = 0.9 // 单次转向最大角度变化
const PAUSE_TURN_CHANCE = 0.02 // 停顿时每帧选定新张望方向的概率
const PAUSE_TURN = 0.9 // 停顿转头幅度（弧度，±）
const PAUSE_TURN_SPEED = 2.6 // 停顿转头角速度（弧度/秒），平滑转向目标
const WALK_TURN_SPEED = 6 // 行走转向角速度（弧度/秒），使转弯有过渡不瞬移
const FLY_CURVE_MAX = 0.9 // 飞行转弯速率上限（弧度/秒，±）
const FLY_CURVE_JITTER = 6 // 飞行转弯速率的随机漂移强度，使路径蜿蜒不规整

const TAU = Math.PI * 2

function randRange(rng: () => number, lo: number, hi: number): number {
  return lo + rng() * (hi - lo)
}

function turn(heading: number, rng: () => number): number {
  return (heading + (rng() - 0.5) * 2 * MAX_TURN_DELTA + TAU) % TAU
}

// 朝目标角度平滑靠近（限步长，处理 ±π 环绕）
function approachAngle(cur: number, target: number, maxStep: number): number {
  const diff = (((target - cur + Math.PI) % TAU) + TAU) % TAU - Math.PI
  if (Math.abs(diff) <= maxStep) return ((target % TAU) + TAU) % TAU
  return (cur + Math.sign(diff) * maxStep + TAU) % TAU
}

export function spawnState(origin: Vec, rng: () => number): RoachState {
  return {
    x: origin.x,
    y: origin.y,
    heading: rng() * TAU,
    speed: randRange(rng, SPEED_MIN, SPEED_MAX),
    phaseTimer: randRange(rng, WALK_MIN, WALK_MAX),
    mode: 'walk',
    curve: 0,
  }
}

export function stepState(s: RoachState, dtSec: number, rng: () => number): RoachState {
  let { heading, speed, phaseTimer, mode } = s
  let curve = s.curve ?? 0
  let turnTarget = s.turnTarget ?? heading
  phaseTimer -= dtSec
  if (phaseTimer <= 0) {
    if (mode !== 'walk') {
      // 停顿 / 飞行结束 → 落地恢复行走（朝新方向平滑转）
      mode = 'walk'
      turnTarget = turn(heading, rng)
      speed = randRange(rng, SPEED_MIN, SPEED_MAX)
      phaseTimer = randRange(rng, WALK_MIN, WALK_MAX)
      curve = 0
    } else {
      const roll = rng()
      if (roll < FLY_CHANCE) {
        // 起飞：快速飞一段，带随机弧度（转弯速率有正有负）
        mode = 'fly'
        heading = turn(heading, rng)
        turnTarget = heading
        speed = randRange(rng, FLY_SPEED_MIN, FLY_SPEED_MAX)
        phaseTimer = randRange(rng, FLY_MIN, FLY_MAX)
        curve = (rng() - 0.5) * 2 * FLY_CURVE_MAX
      } else if (roll < FLY_CHANCE + PAUSE_CHANCE) {
        // 停下发呆
        mode = 'pause'
        speed = 0
        phaseTimer = randRange(rng, PAUSE_MIN, PAUSE_MAX)
        curve = 0
        turnTarget = heading
      } else {
        // 继续走：设新目标方向（行走中平滑转向），换速
        turnTarget = turn(heading, rng)
        speed = randRange(rng, SPEED_MIN, SPEED_MAX)
        phaseTimer = randRange(rng, WALK_MIN, WALK_MAX)
        curve = 0
      }
    }
  }
  if (mode === 'fly') {
    // 飞行：转弯速率随机漂移（布朗式）→ 蜿蜒不规整的路径
    curve += (rng() - 0.5) * FLY_CURVE_JITTER * dtSec
    if (curve > FLY_CURVE_MAX) curve = FLY_CURVE_MAX
    else if (curve < -FLY_CURVE_MAX) curve = -FLY_CURVE_MAX
    heading = (heading + curve * dtSec + TAU) % TAU
    turnTarget = heading
  } else if (mode === 'pause') {
    // 停顿：偶尔选新张望方向，平滑转过去（有过渡）
    if (rng() < PAUSE_TURN_CHANCE) {
      turnTarget = heading + (rng() - 0.5) * 2 * PAUSE_TURN
    }
    heading = approachAngle(heading, turnTarget, PAUSE_TURN_SPEED * dtSec)
  } else {
    // 行走：朝目标方向平滑转向（转弯有过渡，不瞬移）
    heading = approachAngle(heading, turnTarget, WALK_TURN_SPEED * dtSec)
  }
  return {
    x: s.x + Math.cos(heading) * speed * dtSec,
    y: s.y + Math.sin(heading) * speed * dtSec,
    heading,
    speed,
    phaseTimer,
    mode,
    curve,
    turnTarget,
  }
}

export function isOffscreen(s: RoachState, b: Bounds, margin: number): boolean {
  return s.x < -margin || s.y < -margin || s.x > b.width + margin || s.y > b.height + margin
}
