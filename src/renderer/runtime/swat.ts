import swatterUrl from '../../../assets/swatter.png'

// 在 (x,y) 播放一次向下拍击动画
export function playSwat(root: HTMLElement, x: number, y: number): void {
  const el = document.createElement('img')
  el.src = swatterUrl
  el.className = 'swat'
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  root.appendChild(el)
  el.addEventListener('animationend', () => el.remove())
}
