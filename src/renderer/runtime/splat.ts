export function playSplat(root: HTMLElement, x: number, y: number): void {
  // 全屏白闪
  const flash = document.createElement('div')
  flash.className = 'splat-flash'
  root.appendChild(flash)
  flash.addEventListener('animationend', () => flash.remove())

  // 画面震动（重置 class 以支持连续触发）
  root.classList.remove('shake')
  void root.offsetWidth // 强制 reflow，重启动画
  root.classList.add('shake')
  setTimeout(() => root.classList.remove('shake'), 340)

  // 双层冲击环
  for (const cls of ['r1', 'r2']) {
    const ring = document.createElement('div')
    ring.className = `splat-ring ${cls}`
    ring.style.left = `${x}px`
    ring.style.top = `${y}px`
    root.appendChild(ring)
    ring.addEventListener('animationend', () => ring.remove())
  }

  // 大量碎片四射（角度带随机抖动、距离与大小随机）
  const N = 16
  for (let i = 0; i < N; i++) {
    const bit = document.createElement('div')
    bit.className = 'splat-bit'
    bit.style.left = `${x}px`
    bit.style.top = `${y}px`
    const ang = (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
    const dist = 30 + Math.random() * 40
    bit.style.setProperty('--dx', `${Math.cos(ang) * dist}px`)
    bit.style.setProperty('--dy', `${Math.sin(ang) * dist}px`)
    const size = 4 + Math.random() * 5
    bit.style.width = `${size}px`
    bit.style.height = `${size}px`
    root.appendChild(bit)
    bit.addEventListener('animationend', () => bit.remove())
  }
}
