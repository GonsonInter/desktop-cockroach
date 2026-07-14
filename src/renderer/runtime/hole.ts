import holeImg from '../../../assets/hole.png'

export const holeUrl = holeImg
export const HOLE_R = 46

// 非交互的墙洞虚影（拖动跨屏时在目标屏显示）
export function createGhostEl(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'hole ghost'
  el.innerHTML = `<img src="${holeImg}" draggable="false" alt="" />`
  return el
}

export class Hole {
  private el: HTMLElement
  private cx = 0
  private cy = 0

  constructor(
    root: HTMLElement,
    private self: { x: number; y: number },
    private opts: {
      onPunch: (center: { x: number; y: number }) => void
      onDrag: (global: { x: number; y: number }) => void
      onDrop: (global: { x: number; y: number }) => void
    },
  ) {
    this.el = document.createElement('div')
    this.el.className = 'hole'
    this.el.innerHTML = `<img src="${holeImg}" draggable="false" alt="" />`
    root.appendChild(this.el)
    this.bindDrag()
  }

  center(): { x: number; y: number } {
    return { x: this.cx, y: this.cy }
  }

  // 本屏局部坐标定位
  setLocalPos(x: number, y: number): void {
    this.moveTo(x, y)
  }

  showFull(): void {
    this.el.classList.add('full')
    setTimeout(() => this.el.classList.remove('full'), 320)
  }

  destroy(): void {
    this.el.remove()
  }

  private moveTo(x: number, y: number): void {
    this.cx = x
    this.cy = y
    this.el.style.left = `${x}px`
    this.el.style.top = `${y}px`
  }

  private bindDrag(): void {
    let dragging = false
    let moved = false
    let offX = 0
    let offY = 0

    this.el.addEventListener('pointerdown', (e) => {
      dragging = true
      moved = false
      offX = e.clientX - this.cx
      offY = e.clientY - this.cy
      this.el.classList.add('dragging')
      this.el.setPointerCapture(e.pointerId)
    })
    this.el.addEventListener('pointermove', (e) => {
      if (!dragging) return
      const nx = e.clientX - offX
      const ny = e.clientY - offY
      if (Math.abs(nx - this.cx) > 2 || Math.abs(ny - this.cy) > 2) moved = true
      this.moveTo(nx, ny)
      // 上报全局坐标（本屏局部 + 本屏偏移），供主进程路由跨屏虚影
      this.opts.onDrag({ x: nx + this.self.x, y: ny + this.self.y })
    })
    this.el.addEventListener('pointerup', (e) => {
      dragging = false
      this.el.classList.remove('dragging')
      this.el.releasePointerCapture(e.pointerId)
      if (!moved) this.opts.onPunch(this.center())
      else this.opts.onDrop({ x: this.cx + this.self.x, y: this.cy + this.self.y })
    })
  }
}
