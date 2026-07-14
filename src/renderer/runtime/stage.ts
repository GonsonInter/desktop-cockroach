import { Roster } from '../../core/roster'
import { spawnState, stepState, RoachState } from '../../core/kinematics'
import type { Rect } from '../../core/geometry'
import { createRoachEl, setRoachTransform, ROACH_W, ROACH_H, DEATH_MS } from './cockroach'
import { playSplat } from './splat'

export interface DisplayInfo {
  id: number
  x: number
  y: number
  width: number
  height: number
  isPrimary: boolean
}

const CAP = 30

interface Roach {
  el: HTMLElement
  state: RoachState // x/y 为全局屏幕坐标
  dying: boolean
}

export class Stage {
  private roster = new Roster<Roach>(CAP)
  private lastTs = 0
  private rng = () => Math.random()

  constructor(
    private root: HTMLElement,
    private self: DisplayInfo,
    private opts: { onMigrate: (state: RoachState) => void },
  ) {
    requestAnimationFrame(this.tick)
  }

  // origin 为全局坐标（墙洞点击处）
  spawnAt(origin: { x: number; y: number }): boolean {
    return this.addRoach(spawnState(origin, this.rng))
  }

  // 接收从相邻屏移交来的蟑螂（延续其全局坐标状态）
  accept(state: RoachState): void {
    this.addRoach(state)
  }

  private addRoach(state: RoachState): boolean {
    const el = createRoachEl()
    const id = this.roster.add({ el, state, dying: false })
    if (id === null) {
      el.remove()
      return false
    }
    this.root.appendChild(el)
    this.render(el, state)
    return true
  }

  // 全局坐标 → 本屏局部坐标渲染
  private render(el: HTMLElement, s: RoachState): void {
    setRoachTransform(el, s.x - this.self.x, s.y - this.self.y, s.heading)
  }

  clearAll(): void {
    for (const [, r] of this.roster.entries()) r.el.remove()
    this.roster.clear()
  }

  // 命中检测用本屏局部坐标矩形
  roachRects(): Array<{ id: number; rect: Rect }> {
    return this.roster.entries().map(([id, r]) => ({
      id,
      rect: {
        x: r.state.x - this.self.x - ROACH_W / 2,
        y: r.state.y - this.self.y - ROACH_H / 2,
        w: ROACH_W,
        h: ROACH_H,
      },
    }))
  }

  killRoach(id: number): void {
    const entry = this.roster.entries().find(([rid]) => rid === id)
    if (!entry) return
    const r = entry[1]
    if (r.dying) return
    r.dying = true
    playSplat(this.root, r.state.x - this.self.x, r.state.y - this.self.y)
    r.el.classList.add('dying')
    setTimeout(() => r.el.classList.add('fade'), 120)
    setTimeout(() => {
      r.el.remove()
      this.roster.remove(id)
    }, DEATH_MS)
  }

  // 蟑螂中心是否仍在本屏范围内
  private inSelf(s: RoachState): boolean {
    return (
      s.x >= this.self.x &&
      s.x < this.self.x + this.self.width &&
      s.y >= this.self.y &&
      s.y < this.self.y + this.self.height
    )
  }

  private tick = (ts: number): void => {
    const dt = this.lastTs ? Math.min((ts - this.lastTs) / 1000, 0.05) : 0
    this.lastTs = ts
    for (const [id, r] of this.roster.entries()) {
      if (r.dying) continue
      r.state = stepState(r.state, dt, this.rng)
      if (!this.inSelf(r.state)) {
        // 离开本屏 → 交主进程路由到相邻屏（或销毁）；本地静默移除
        this.opts.onMigrate(r.state)
        r.el.remove()
        this.roster.remove(id)
        continue
      }
      this.render(r.el, r.state)
      r.el.classList.toggle('paused', r.state.mode === 'pause')
      r.el.classList.toggle('flying', r.state.mode === 'fly')
    }
    requestAnimationFrame(this.tick)
  }
}
