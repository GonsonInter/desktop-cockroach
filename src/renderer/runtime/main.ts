import { Stage, DisplayInfo } from './stage'
import { Hole, HOLE_R, createGhostEl, holeUrl } from './hole'
import { pointInCircle, pointInRect } from '../../core/geometry'
import type { RoachState } from '../../core/kinematics'
import swatterUrl from '../../../assets/swatter.png'

declare global {
  interface Window {
    roachAPI: {
      setMouseIgnore(ignore: boolean): void
      onClearAll(cb: () => void): void
      getSelfInfo(): DisplayInfo | null
      migrate(state: RoachState): void
      onAccept(cb: (state: RoachState) => void): void
      holeDrag(g: { x: number; y: number }): void
      holeDrop(g: { x: number; y: number }): void
      onGhostHole(cb: (p: { x: number; y: number } | null) => void): void
      onSetHoleOwner(cb: (p: { x: number; y: number } | null) => void): void
      onSetSpawnMode(cb: (mode: 'click' | 'timed') => void): void
      quit(): void
    }
  }
}

const self = window.roachAPI.getSelfInfo()
const root = document.getElementById('stage')!

if (self) {
  const me = self
  const stage = new Stage(root, me, {
    onMigrate: (s) => window.roachAPI.migrate(s),
  })
  window.roachAPI.onAccept((s) => stage.accept(s))
  window.roachAPI.onClearAll(() => stage.clearAll())

  // ── 墙洞（可跨屏拖动，属主窗口才持有实体） ──
  let hole: Hole | null = null
  const makeHole = (): Hole =>
    new Hole(root, me, {
      onPunch: (localCenter) => {
        const g = { x: localCenter.x + me.x, y: localCenter.y + me.y }
        if (!stage.spawnAt(g)) hole?.showFull()
      },
      onDrag: (g) => window.roachAPI.holeDrag(g),
      onDrop: (g) => window.roachAPI.holeDrop(g),
    })
  // 主屏初始持有墙洞（右下角）
  if (me.isPrimary) {
    hole = makeHole()
    hole.setLocalPos(window.innerWidth - 90, window.innerHeight - 90)
  }
  // 拖动跨屏后主进程重新指派属主
  window.roachAPI.onSetHoleOwner((p) => {
    if (p) {
      if (!hole) hole = makeHole()
      hole.setLocalPos(p.x, p.y)
    } else if (hole) {
      hole.destroy()
      hole = null
    }
  })
  // 拖动跨屏时在目标屏显示虚影
  let ghostEl: HTMLElement | null = null
  window.roachAPI.onGhostHole((p) => {
    if (p) {
      if (!ghostEl) {
        ghostEl = createGhostEl()
        root.appendChild(ghostEl)
      }
      ghostEl.style.left = `${p.x}px`
      ghostEl.style.top = `${p.y}px`
    } else if (ghostEl) {
      ghostEl.remove()
      ghostEl = null
    }
  })

  // ── 产出方式：点击 / 定时 / 随机（只有持有墙洞的窗口会自动产出） ──
  let spawnMode: 'click' | 'timed' | 'random' = 'click'
  let intervalMs = 3000
  let spawnTimer: number | undefined
  const doSpawn = () => {
    if (!hole) return
    const c = hole.center()
    stage.spawnAt({ x: c.x + me.x, y: c.y + me.y })
  }
  const clearSpawn = () => {
    if (spawnTimer !== undefined) {
      clearTimeout(spawnTimer)
      clearInterval(spawnTimer)
      spawnTimer = undefined
    }
  }
  const scheduleRandom = () => {
    const delay = 500 + Math.random() * 4000 // 0.5–4.5 秒随机
    spawnTimer = window.setTimeout(() => {
      doSpawn()
      if (spawnMode === 'random') scheduleRandom()
    }, delay)
  }
  const refreshSpawn = () => {
    clearSpawn()
    if (spawnMode === 'timed') spawnTimer = window.setInterval(doSpawn, intervalMs)
    else if (spawnMode === 'random') scheduleRandom()
  }
  window.roachAPI.onSetSpawnMode((m) => {
    spawnMode = m
    refreshSpawn()
  })
  window.roachAPI.onSetSpawnInterval((ms) => {
    intervalMs = ms
    if (spawnMode === 'timed') refreshSpawn()
  })

  // ── 苍蝇拍（跟随鼠标的 DOM 假光标：悬停抬起，点击向下拍） ──
  const swatter = document.createElement('img')
  swatter.src = swatterUrl
  swatter.className = 'swatter-cursor'
  swatter.style.display = 'none'
  root.appendChild(swatter)
  swatter.addEventListener('animationend', () => swatter.classList.remove('swat'))
  const moveSwatter = (x: number, y: number) => {
    swatter.style.left = `${x}px`
    swatter.style.top = `${y}px`
  }
  const swatDown = () => {
    swatter.classList.remove('swat')
    void swatter.offsetWidth // 重启动画
    swatter.classList.add('swat')
  }

  // 点击命中蟑螂 → 拍死 + 向下拍；墙洞区域内只生成不误杀
  window.addEventListener('mousedown', (e) => {
    if (hole) {
      const c = hole.center()
      if (pointInCircle(e.clientX, e.clientY, c.x, c.y, HOLE_R)) return
    }
    let swatted = false
    for (const { id, rect } of stage.roachRects()) {
      if (pointInRect(e.clientX, e.clientY, rect)) {
        stage.killRoach(id)
        swatted = true
        break
      }
    }
    if (swatted) swatDown()
  })

  // 命中墙洞/蟑螂时接管点击，否则穿透；悬停蟑螂时显示抬起的苍蝇拍
  let ignoring = true
  const hits = (px: number, py: number): boolean => {
    if (hole) {
      const c = hole.center()
      if (pointInCircle(px, py, c.x, c.y, HOLE_R)) return true
    }
    return stage.roachRects().some(({ rect }) => pointInRect(px, py, rect))
  }
  window.addEventListener('mousemove', (e) => {
    const shouldIgnore = !hits(e.clientX, e.clientY)
    if (shouldIgnore !== ignoring) {
      ignoring = shouldIgnore
      window.roachAPI.setMouseIgnore(shouldIgnore)
    }
    const overRoach = stage.roachRects().some(({ rect }) => pointInRect(e.clientX, e.clientY, rect))
    if (overRoach) {
      moveSwatter(e.clientX, e.clientY)
      swatter.style.display = ''
      root.style.cursor = 'none' // 藏系统光标，用 DOM 苍蝇拍代替
    } else {
      swatter.style.display = 'none'
      root.style.cursor = ''
    }
  })
}

export {}
