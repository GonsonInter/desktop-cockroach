export const ROACH_W = 52
export const ROACH_H = 30
export const DEATH_MS = 400

// 俯视蟑螂，头朝 +x（右）。照真实美洲大蠊比例/配色重画。
// viewBox 68x40，身体沿 x 轴，中线 y=20。
const SVG = `
<svg width="68" height="40" viewBox="0 0 68 40" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="roach-body" cx="62%" cy="40%" r="75%">
      <stop offset="0%" stop-color="#9a4d1e" />
      <stop offset="45%" stop-color="#793914" />
      <stop offset="100%" stop-color="#4f2610" />
    </radialGradient>
    <radialGradient id="roach-shield" cx="58%" cy="34%" r="70%">
      <stop offset="0%" stop-color="#b5762f" />
      <stop offset="55%" stop-color="#8a4a1e" />
      <stop offset="100%" stop-color="#5a2c12" />
    </radialGradient>
  </defs>

  <!-- 腿：每条一个 g（腿骨折线），绕根部摆动，三角步态两组相位 -->
  <g stroke="#4a2410" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <g class="leg up l1"><path d="M47 13 L51 7 L54 2" /></g>
    <g class="leg up l2"><path d="M40 12 L38 5 L33 1" /></g>
    <g class="leg up l1"><path d="M33 13 L25 6 L17 2" /></g>
    <g class="leg down l2"><path d="M47 27 L51 33 L54 38" /></g>
    <g class="leg down l1"><path d="M40 28 L38 35 L33 39" /></g>
    <g class="leg down l2"><path d="M33 27 L25 34 L17 38" /></g>
  </g>

  <!-- 触须：长，绕头端摆动 -->
  <g stroke="#4a2410" fill="none" stroke-width="1.4" stroke-linecap="round">
    <g class="antenna a1"><path d="M57 17.5 Q64 12 67 5" /></g>
    <g class="antenna a2"><path d="M57 22.5 Q64 28 67 35" /></g>
  </g>

  <!-- 尾须 -->
  <g stroke="#4a2410" stroke-width="1.4" stroke-linecap="round">
    <path d="M8 17 L2 12" />
    <path d="M8 23 L2 28" />
  </g>

  <!-- 腹部/翅（后宽前窄） -->
  <ellipse cx="24" cy="20" rx="18" ry="12" fill="url(#roach-body)" stroke="#2c1608" stroke-width="0.8" />
  <!-- 翅脉与中缝 -->
  <g stroke="#3a1c0c" fill="none" opacity="0.55" stroke-width="0.8">
    <path d="M7 20 L42 20" />
    <path d="M13 12 Q28 15 40 19" />
    <path d="M13 28 Q28 25 40 21" />
  </g>
  <!-- 翅面油亮高光 -->
  <ellipse cx="20" cy="14" rx="11" ry="3.6" fill="#ffffff" opacity="0.16" />

  <!-- 盾板 pronotum + 中央暗斑 -->
  <ellipse cx="45" cy="20" rx="8.5" ry="10.5" fill="url(#roach-shield)" stroke="#2c1608" stroke-width="0.8" />
  <ellipse cx="45.5" cy="20" rx="4.6" ry="6.6" fill="#421d08" opacity="0.85" />
  <ellipse cx="43" cy="16.5" rx="2.2" ry="1.4" fill="#ffffff" opacity="0.14" />

  <!-- 头 + 复眼 -->
  <ellipse cx="54" cy="20" rx="4" ry="5.2" fill="#3d1d0a" />
  <circle cx="52.5" cy="15.6" r="1.9" fill="#140a05" />
  <circle cx="52.5" cy="24.4" r="1.9" fill="#140a05" />

  <!-- 飞行翅膀（上层，默认收拢隐藏；flying 时张开煽动）
       每侧两片：大后翅（膜质半透明、展得开、主扇动）+ 窄前翅（革质深色、张得小） -->
  <g class="wings">
    <!-- 后翅：膜质半透明扇形（每侧一大片，横向铺开） -->
    <g fill="#b0783f" fill-opacity="0.4" stroke="#7a4a26" stroke-width="0.5" stroke-linejoin="round">
      <path d="M38 16 C30 -6 12 -6 6 8 C1 16 5 21 15 22 C27 21 34 18 38 17 Z" />
      <path d="M38 24 C30 46 12 46 6 32 C1 24 5 19 15 18 C27 19 34 22 38 23 Z" />
    </g>
    <!-- 后翅放射翅脉（折扇纹路） -->
    <g stroke="#8a5a30" stroke-width="0.5" fill="none" opacity="0.55">
      <path d="M38 16 L14 -3" /><path d="M38 16 L4 12" /><path d="M38 16 L13 21" />
      <path d="M38 24 L14 43" /><path d="M38 24 L4 28" /><path d="M38 24 L13 19" />
    </g>
    <!-- 前翅：革质深色、窄，斜张盖在后翅内上侧 -->
    <g fill="#6b3410" fill-opacity="0.9" stroke="#3a1c0c" stroke-width="0.6" stroke-linejoin="round">
      <path d="M38 15 Q27 5 18 10 Q29 15 38 16 Z" />
      <path d="M38 25 Q27 35 18 30 Q29 25 38 24 Z" />
    </g>
  </g>
</svg>`

export function createRoachEl(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'roach'
  el.innerHTML = SVG
  return el
}

export function setRoachTransform(el: HTMLElement, x: number, y: number, heading: number): void {
  const t = `translate(${x}px, ${y}px) rotate(${heading}rad)`
  el.style.transform = t
  el.style.setProperty('--squash', t) // 供死亡动画复用当前朝向
}
