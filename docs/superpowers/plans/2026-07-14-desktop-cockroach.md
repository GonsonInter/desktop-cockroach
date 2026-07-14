# 桌面蟑螂 Desktop Cockroach 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一个 macOS 后台 Electron 应用——桌面常驻墙洞，点击钻出带爬行动效的蟑螂，随机乱爬、出屏销毁、点中拍死。

**Architecture:** 透明置顶全屏覆盖层默认鼠标穿透；渲染进程用 `mousemove` 对墙洞和蟑螂做包围盒命中，命中时经 IPC 请主进程临时接管点击。可纯逻辑化的运动学 / 几何命中 / 数量花名册抽成 `src/core/` 纯模块走 TDD（vitest）；Electron 与 DOM 接线用「构建 + 手动跑」验证。

**Tech Stack:** Electron 42、electron-vite 5、TypeScript（strict）、Vitest、纯 SVG/CSS 绘制蟑螂。

## Global Constraints

- 平台仅 macOS，只做单主显示器（`screen.getPrimaryDisplay().workAreaSize`）。
- 后台应用无主窗口；唯一控制入口是菜单栏托盘：`清空所有蟑螂` / `退出`。
- 覆盖层默认 `setIgnoreMouseEvents(true, { forward: true })`，仅命中墙洞或蟑螂时临时接管。
- 墙洞默认右下角、可拖动；蟑螂同时最多 **30** 只。
- 纯代码绘制，无图片/视频/AI 素材；不做逐像素命中（包围盒即可）。
- `src/core/` 为纯逻辑（不 import electron / DOM），全部 vitest 覆盖。
- ESM 项目（`"type": "module"`）；preload 产物为 `.mjs`，主窗口 `sandbox: false`。

---

### Task 1: 项目脚手架

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `electron.vite.config.ts`
- Create: `vitest.config.ts`
- Create: `src/core/smoke.ts`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produces: 可运行的 `npm test` / `npm run dev` / `npm run build`；`src/core/smoke.ts` 导出 `export const ready = true`（仅验证工具链，后续任务会删）。

- [ ] **Step 1: 写 package.json**

```json
{
  "name": "desktop-cockroach",
  "version": "0.1.0",
  "description": "桌面蟑螂 - 点墙洞钻出蟑螂满屏爬",
  "main": "out/main/index.js",
  "type": "module",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "start": "electron-vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@types/node": "^25.9.2",
    "electron": "^42.3.3",
    "electron-vite": "^5.0.0",
    "typescript": "^6.0.3",
    "vite": "^7.3.5",
    "vitest": "^4.1.8"
  }
}
```

- [ ] **Step 2: 写 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node", "vitest/globals"],
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "outDir": "dist"
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: 写 electron.vite.config.ts**

```ts
import { defineConfig } from 'electron-vite'
import { resolve } from 'node:path'

export default defineConfig({
  main: { build: { rollupOptions: { input: resolve('src/main/index.ts') } } },
  preload: { build: { rollupOptions: { input: resolve('src/preload/index.ts') } } },
  renderer: {
    build: {
      rollupOptions: {
        input: { runtime: resolve('src/renderer/runtime/index.html') },
      },
    },
  },
})
```

- [ ] **Step 4: 写 vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { globals: true, include: ['tests/**/*.test.ts'] },
})
```

- [ ] **Step 5: 写冒烟模块与失败测试**

`src/core/smoke.ts`:
```ts
export const ready = true
```

`tests/smoke.test.ts`:
```ts
import { ready } from '../src/core/smoke'

test('toolchain ready', () => {
  expect(ready).toBe(true)
})
```

- [ ] **Step 6: 安装依赖并跑测试**

Run: `cd ~/develop/desktop-cockroach && npm install && npm test`
Expected: 测试 PASS。若报 `Error: Electron uninstall`，用镜像补装：
`ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" node node_modules/electron/install.js`

- [ ] **Step 7: 提交**

```bash
git add -A && git commit -m "chore: 项目脚手架 electron-vite + vitest"
```

---

### Task 2: 运动学纯核心

**Files:**
- Create: `src/core/kinematics.ts`
- Test: `tests/kinematics.test.ts`

**Interfaces:**
- Produces:
  - `interface Vec { x: number; y: number }`
  - `interface RoachState { x: number; y: number; heading: number; speed: number; turnTimer: number }`
  - `interface Bounds { width: number; height: number }`
  - `const SPEED_MIN = 60, SPEED_MAX = 180`（px/s）
  - `function spawnState(origin: Vec, rng: () => number): RoachState`
  - `function stepState(s: RoachState, dtSec: number, rng: () => number): RoachState`（返回新对象，不改入参）
  - `function isOffscreen(s: RoachState, b: Bounds, margin: number): boolean`
- Consumes: 无。

- [ ] **Step 1: 写失败测试**

`tests/kinematics.test.ts`:
```ts
import { spawnState, stepState, isOffscreen, SPEED_MIN, SPEED_MAX } from '../src/core/kinematics'

// 固定序列 rng，可预测
function seqRng(values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

test('spawnState 位置在 origin，速度在范围内，heading 在 [0,2π)', () => {
  const s = spawnState({ x: 100, y: 200 }, seqRng([0.5, 0.5]))
  expect(s.x).toBe(100)
  expect(s.y).toBe(200)
  expect(s.speed).toBeGreaterThanOrEqual(SPEED_MIN)
  expect(s.speed).toBeLessThanOrEqual(SPEED_MAX)
  expect(s.heading).toBeGreaterThanOrEqual(0)
  expect(s.heading).toBeLessThan(Math.PI * 2)
})

test('stepState 在不转向时按 speed*dt 沿 heading 前进', () => {
  const s = { x: 0, y: 0, heading: 0, speed: 100, turnTimer: 999 }
  const n = stepState(s, 0.1, seqRng([0.5]))
  expect(n.x).toBeCloseTo(10, 5) // 100 * 0.1
  expect(n.y).toBeCloseTo(0, 5)
  expect(s.x).toBe(0) // 不改入参
})

test('stepState 在 turnTimer 归零时改变 heading 并重置计时', () => {
  const s = { x: 0, y: 0, heading: 0, speed: 100, turnTimer: 0.05 }
  const n = stepState(s, 0.1, seqRng([1, 1]))
  expect(n.heading).not.toBe(0)
  expect(n.turnTimer).toBeGreaterThan(0)
})

test('isOffscreen 中心越过边界+margin 时为真', () => {
  const b = { width: 800, height: 600 }
  expect(isOffscreen({ x: -60, y: 300, heading: 0, speed: 0, turnTimer: 0 }, b, 50)).toBe(true)
  expect(isOffscreen({ x: 400, y: 300, heading: 0, speed: 0, turnTimer: 0 }, b, 50)).toBe(false)
  expect(isOffscreen({ x: 861, y: 300, heading: 0, speed: 0, turnTimer: 0 }, b, 50)).toBe(true)
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- kinematics`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 写实现**

`src/core/kinematics.ts`:
```ts
export interface Vec { x: number; y: number }
export interface RoachState {
  x: number
  y: number
  heading: number // 弧度，前进方向
  speed: number // px/s
  turnTimer: number // 秒，下次随机转向倒计时
}
export interface Bounds { width: number; height: number }

export const SPEED_MIN = 60
export const SPEED_MAX = 180
const TURN_MIN = 0.3
const TURN_MAX = 1.5
const MAX_TURN_DELTA = 0.9 // 单次转向最大角度变化

const TAU = Math.PI * 2

function randRange(rng: () => number, lo: number, hi: number): number {
  return lo + rng() * (hi - lo)
}

export function spawnState(origin: Vec, rng: () => number): RoachState {
  return {
    x: origin.x,
    y: origin.y,
    heading: rng() * TAU,
    speed: randRange(rng, SPEED_MIN, SPEED_MAX),
    turnTimer: randRange(rng, TURN_MIN, TURN_MAX),
  }
}

export function stepState(s: RoachState, dtSec: number, rng: () => number): RoachState {
  let { heading, speed, turnTimer } = s
  turnTimer -= dtSec
  if (turnTimer <= 0) {
    heading = (heading + (rng() - 0.5) * 2 * MAX_TURN_DELTA + TAU) % TAU
    speed = randRange(rng, SPEED_MIN, SPEED_MAX)
    turnTimer = randRange(rng, TURN_MIN, TURN_MAX)
  }
  return {
    x: s.x + Math.cos(heading) * speed * dtSec,
    y: s.y + Math.sin(heading) * speed * dtSec,
    heading,
    speed,
    turnTimer,
  }
}

export function isOffscreen(s: RoachState, b: Bounds, margin: number): boolean {
  return s.x < -margin || s.y < -margin || s.x > b.width + margin || s.y > b.height + margin
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test -- kinematics`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "feat: 蟑螂运动学纯核心 + 单测"
```

---

### Task 3: 命中几何纯核心

**Files:**
- Create: `src/core/geometry.ts`
- Test: `tests/geometry.test.ts`

**Interfaces:**
- Produces:
  - `interface Rect { x: number; y: number; w: number; h: number }`（x,y 为左上角）
  - `function pointInRect(px: number, py: number, r: Rect): boolean`
  - `function pointInCircle(px: number, py: number, cx: number, cy: number, radius: number): boolean`

- [ ] **Step 1: 写失败测试**

`tests/geometry.test.ts`:
```ts
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- geometry`
Expected: FAIL。

- [ ] **Step 3: 写实现**

`src/core/geometry.ts`:
```ts
export interface Rect { x: number; y: number; w: number; h: number }

export function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
}

export function pointInCircle(px: number, py: number, cx: number, cy: number, radius: number): boolean {
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy <= radius * radius
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test -- geometry`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "feat: 命中几何纯核心 + 单测"
```

---

### Task 4: 数量花名册纯核心

**Files:**
- Create: `src/core/roster.ts`
- Test: `tests/roster.test.ts`

**Interfaces:**
- Produces:
  - `class Roster<T>`
    - `constructor(cap: number)`
    - `add(item: T): number | null` —— 满员返回 `null`，否则返回自增数字 id
    - `remove(id: number): void`
    - `get size(): number`
    - `entries(): Array<[number, T]>`
    - `clear(): void`

- [ ] **Step 1: 写失败测试**

`tests/roster.test.ts`:
```ts
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
  expect(r.add('b')).toBe(2) // id 继续自增，不复用
})

test('entries 与 clear', () => {
  const r = new Roster<number>(5)
  r.add(10)
  r.add(20)
  expect(r.entries().map(([, v]) => v)).toEqual([10, 20])
  r.clear()
  expect(r.size).toBe(0)
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- roster`
Expected: FAIL。

- [ ] **Step 3: 写实现**

`src/core/roster.ts`:
```ts
export class Roster<T> {
  private items = new Map<number, T>()
  private nextId = 0
  constructor(private cap: number) {}

  add(item: T): number | null {
    if (this.items.size >= this.cap) return null
    const id = this.nextId++
    this.items.set(id, item)
    return id
  }

  remove(id: number): void {
    this.items.delete(id)
  }

  get size(): number {
    return this.items.size
  }

  entries(): Array<[number, T]> {
    return [...this.items.entries()]
  }

  clear(): void {
    this.items.clear()
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test -- roster`
Expected: PASS。删除 Task 1 遗留的冒烟文件：

```bash
rm src/core/smoke.ts tests/smoke.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "feat: 数量花名册纯核心 + 单测；移除冒烟占位"
```

---

### Task 5: Electron 主进程与透明覆盖窗

**Files:**
- Create: `src/main/window.ts`
- Create: `src/main/index.ts`
- Create: `src/preload/index.ts`
- Create: `src/renderer/runtime/index.html`
- Create: `src/renderer/runtime/main.ts`

**Interfaces:**
- Produces（渲染进程可用的 `window.roachAPI`）:
  - `setMouseIgnore(ignore: boolean): void` —— IPC `roach:setMouseIgnore`
  - `onClearAll(cb: () => void): void` —— IPC `roach:clearAll`（主→渲染）
  - `quit(): void` —— IPC `roach:quit`
- Consumes: 无。

- [ ] **Step 1: 写透明窗 `src/main/window.ts`**

```ts
import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'

export function createOverlayWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const win = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.webContents.on('console-message', (...args: unknown[]) => {
    const a = args as [unknown, number?, string?]
    const ev = a[0] as { message?: string }
    const msg = typeof a[2] === 'string' ? a[2] : (ev?.message ?? '')
    process.stdout.write(`[renderer] ${msg}\n`)
  })

  // 默认全穿透，renderer 命中墙洞/蟑螂时再临时接管
  win.setIgnoreMouseEvents(true, { forward: true })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/runtime/index.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/runtime/index.html'))
  }
  return win
}
```

- [ ] **Step 2: 写主进程 `src/main/index.ts`**（托盘留到 Task 6，先用最简版启动窗口）

```ts
import { app, ipcMain, BrowserWindow } from 'electron'
import { createOverlayWindow } from './window'

let overlay: BrowserWindow | null = null

app.whenReady().then(() => {
  overlay = createOverlayWindow()

  ipcMain.on('roach:setMouseIgnore', (_e, ignore: boolean) => {
    overlay?.setIgnoreMouseEvents(ignore, { forward: true })
  })
  ipcMain.on('roach:quit', () => app.quit())
})

app.on('window-all-closed', () => {
  // 常驻托盘，不随窗口关闭退出
})
```

- [ ] **Step 3: 写 preload `src/preload/index.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('roachAPI', {
  setMouseIgnore: (ignore: boolean) => ipcRenderer.send('roach:setMouseIgnore', ignore),
  onClearAll: (cb: () => void) => ipcRenderer.on('roach:clearAll', () => cb()),
  quit: () => ipcRenderer.send('roach:quit'),
})
```

- [ ] **Step 4: 写渲染 HTML `src/renderer/runtime/index.html`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: transparent;
        user-select: none;
        -webkit-user-select: none;
      }
      #stage { position: fixed; inset: 0; }
    </style>
  </head>
  <body>
    <div id="stage"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: 写渲染入口 `src/renderer/runtime/main.ts`**（先只验证透明窗与 API 桥）

```ts
declare global {
  interface Window {
    roachAPI: {
      setMouseIgnore(ignore: boolean): void
      onClearAll(cb: () => void): void
      quit(): void
    }
  }
}

console.log('[roach] renderer booted, roachAPI =', typeof window.roachAPI)
export {}
```

- [ ] **Step 6: 构建并手动跑**

Run: `npm run dev`
Expected: 出现一个全屏透明窗（看不到明显内容但不报错），终端打印 `[renderer] [roach] renderer booted, roachAPI = object`。确认此时鼠标可正常操作桌面其他软件（全穿透）。用 Ctrl+C 结束。

- [ ] **Step 7: 提交**

```bash
git add -A && git commit -m "feat: Electron 透明置顶覆盖窗 + preload 桥"
```

---

### Task 6: 托盘菜单（清空 / 退出）

**Files:**
- Create: `src/main/tray.ts`
- Modify: `src/main/index.ts`

**Interfaces:**
- Produces: `function createTray(opts: { onClearAll: () => void }): Tray`
- Consumes: `overlay.webContents.send('roach:clearAll')`、`app.quit()`。

- [ ] **Step 1: 写 `src/main/tray.ts`**

```ts
import { Tray, Menu, nativeImage, app } from 'electron'

export function createTray(opts: { onClearAll: () => void }): Tray {
  const tray = new Tray(nativeImage.createEmpty())
  tray.setTitle('🪳')
  const menu = Menu.buildFromTemplate([
    { label: '清空所有蟑螂', click: () => opts.onClearAll() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ])
  tray.setContextMenu(menu)
  return tray
}
```

- [ ] **Step 2: 在主进程接线**

修改 `src/main/index.ts`，在文件顶部加入 `import { createTray } from './tray'`，并在 `app.whenReady().then(() => { ... })` 内 `overlay = createOverlayWindow()` 之后加：

```ts
  createTray({
    onClearAll: () => overlay?.webContents.send('roach:clearAll'),
  })
```

- [ ] **Step 3: 构建并手动跑**

Run: `npm run dev`
Expected: 菜单栏出现 `🪳` 图标，点开有「清空所有蟑螂 / 退出」两项；点「退出」应用关闭。

- [ ] **Step 4: 提交**

```bash
git add -A && git commit -m "feat: 托盘菜单 清空/退出"
```

---

### Task 7: 蟑螂 DOM 元素与爬行动效

**Files:**
- Create: `src/renderer/runtime/cockroach.ts`
- Create: `src/renderer/runtime/roach.css`
- Modify: `src/renderer/runtime/index.html`（引入 css）
- Modify: `src/renderer/runtime/main.ts`（临时挂一只静态蟑螂目检）

**Interfaces:**
- Produces:
  - `const ROACH_W = 44, ROACH_H = 28`（蟑螂包围盒尺寸 px）
  - `function createRoachEl(): HTMLElement` —— 返回一个已含 SVG 结构、带 CSS 动效类的元素；调用方负责定位与朝向。
  - `function setRoachTransform(el: HTMLElement, x: number, y: number, heading: number): void` —— 以中心 (x,y) 定位并按 heading 旋转（蟑螂头朝 +x 方向，即 rotate(heading)）。

- [ ] **Step 1: 写 css `src/renderer/runtime/roach.css`**

```css
.roach {
  position: fixed;
  left: 0;
  top: 0;
  width: 44px;
  height: 28px;
  margin-left: -22px; /* 让 transform 定位以中心为基准 */
  margin-top: -14px;
  will-change: transform;
  pointer-events: none;
}
.roach .leg {
  transform-origin: center;
  animation: roach-legs 0.18s linear infinite;
}
.roach .leg.b { animation-delay: 0.09s; }
@keyframes roach-legs {
  0%   { transform: rotate(-14deg); }
  50%  { transform: rotate(14deg); }
  100% { transform: rotate(-14deg); }
}
.roach .antenna {
  transform-origin: 30px 14px;
  animation: roach-antenna 0.5s ease-in-out infinite alternate;
}
@keyframes roach-antenna {
  from { transform: rotate(-6deg); }
  to   { transform: rotate(6deg); }
}
.roach.dying { animation: roach-squash 0.12s forwards; }
@keyframes roach-squash {
  to { transform: var(--squash) scaleY(0.3); filter: brightness(0.6); }
}
```

- [ ] **Step 2: 写 `src/renderer/runtime/cockroach.ts`**

蟑螂朝 +x（右）为正面绘制；身体椭圆、头部、两根触角、每侧三条腿。

```ts
export const ROACH_W = 44
export const ROACH_H = 28

const SVG = `
<svg width="44" height="28" viewBox="0 0 44 28" xmlns="http://www.w3.org/2000/svg">
  <g stroke="#2b1a12" stroke-width="1.5" stroke-linecap="round">
    <line class="leg" x1="14" y1="9"  x2="6"  y2="2" />
    <line class="leg b" x1="14" y1="14" x2="4"  y2="14" />
    <line class="leg" x1="14" y1="19" x2="6"  y2="26" />
    <line class="leg b" x1="26" y1="9"  x2="34" y2="2" />
    <line class="leg" x1="26" y1="14" x2="36" y2="14" />
    <line class="leg b" x1="26" y1="19" x2="34" y2="26" />
    <line class="antenna" x1="30" y1="12" x2="42" y2="6" />
    <line class="antenna" x1="30" y1="16" x2="42" y2="20" />
  </g>
  <ellipse cx="20" cy="14" rx="13" ry="8" fill="#3a2418" />
  <ellipse cx="30" cy="14" rx="6" ry="6" fill="#2b1a12" />
  <path d="M20 6 L20 22" stroke="#241009" stroke-width="1" opacity="0.5" />
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
```

- [ ] **Step 3: 在 HTML 引入 css**

在 `src/renderer/runtime/index.html` 的 `<head>` 内、`<style>` 之前加：
```html
    <link rel="stylesheet" href="./roach.css" />
```

- [ ] **Step 4: 临时目检——在 main.ts 挂一只**

把 `src/renderer/runtime/main.ts` 改为：
```ts
import { createRoachEl, setRoachTransform } from './cockroach'

declare global {
  interface Window {
    roachAPI: {
      setMouseIgnore(ignore: boolean): void
      onClearAll(cb: () => void): void
      quit(): void
    }
  }
}

const stage = document.getElementById('stage')!
const el = createRoachEl()
stage.appendChild(el)
setRoachTransform(el, 300, 300, 0)
console.log('[roach] one roach mounted')
export {}
```

- [ ] **Step 5: 构建并手动跑**

Run: `npm run dev`
Expected: 屏幕 (300,300) 处出现一只蟑螂，腿在摆动、触角在轻抖。确认外观可接受。

- [ ] **Step 6: 提交**

```bash
git add -A && git commit -m "feat: SVG 蟑螂元素 + 腿/触角爬行动效"
```

---

### Task 8: 舞台驱动——生成、移动、出屏销毁

**Files:**
- Create: `src/renderer/runtime/stage.ts`
- Modify: `src/renderer/runtime/main.ts`

**Interfaces:**
- Produces:
  - `class Stage`
    - `constructor(root: HTMLElement)`
    - `spawn(origin: { x: number; y: number }): boolean` —— 满员（30）返回 false
    - `clearAll(): void`
    - `roachRects(): Array<{ id: number; rect: import('../../core/geometry').Rect }>` —— 供命中检测用（Task 10）
    - `killRoach(id: number): void` —— 播死亡动画后移除（Task 11 用；本任务先给最简版：直接移除）
  - 内部用单个 `requestAnimationFrame` 驱动所有蟑螂，用 `kinematics.stepState` 更新、`isOffscreen` 判定销毁。
- Consumes: `Roster`、`kinematics.*`、`createRoachEl`/`setRoachTransform`/`ROACH_W`/`ROACH_H`。

- [ ] **Step 1: 写 `src/renderer/runtime/stage.ts`**

```ts
import { Roster } from '../../core/roster'
import { spawnState, stepState, isOffscreen, RoachState } from '../../core/kinematics'
import type { Rect } from '../../core/geometry'
import { createRoachEl, setRoachTransform, ROACH_W, ROACH_H } from './cockroach'

const CAP = 30
const OFFSCREEN_MARGIN = 40

interface Roach {
  el: HTMLElement
  state: RoachState
  dying: boolean
}

export class Stage {
  private roster = new Roster<Roach>(CAP)
  private lastTs = 0
  private rng = () => Math.random()

  constructor(private root: HTMLElement) {
    requestAnimationFrame(this.tick)
  }

  spawn(origin: { x: number; y: number }): boolean {
    const el = createRoachEl()
    const state = spawnState(origin, this.rng)
    const id = this.roster.add({ el, state, dying: false })
    if (id === null) {
      el.remove()
      return false
    }
    this.root.appendChild(el)
    setRoachTransform(el, state.x, state.y, state.heading)
    return true
  }

  clearAll(): void {
    for (const [, r] of this.roster.entries()) r.el.remove()
    this.roster.clear()
  }

  roachRects(): Array<{ id: number; rect: Rect }> {
    return this.roster.entries().map(([id, r]) => ({
      id,
      rect: { x: r.state.x - ROACH_W / 2, y: r.state.y - ROACH_H / 2, w: ROACH_W, h: ROACH_H },
    }))
  }

  killRoach(id: number): void {
    const entry = this.roster.entries().find(([rid]) => rid === id)
    if (!entry) return
    const r = entry[1]
    r.el.remove()
    this.roster.remove(id)
  }

  private tick = (ts: number): void => {
    const dt = this.lastTs ? Math.min((ts - this.lastTs) / 1000, 0.05) : 0
    this.lastTs = ts
    const bounds = { width: window.innerWidth, height: window.innerHeight }
    for (const [id, r] of this.roster.entries()) {
      if (r.dying) continue
      r.state = stepState(r.state, dt, this.rng)
      setRoachTransform(r.el, r.state.x, r.state.y, r.state.heading)
      if (isOffscreen(r.state, bounds, OFFSCREEN_MARGIN)) {
        r.el.remove()
        this.roster.remove(id)
      }
    }
    requestAnimationFrame(this.tick)
  }
}
```

- [ ] **Step 2: 在 main.ts 用 Stage 目检**（临时定时生成几只观察乱爬与出屏销毁）

把 `src/renderer/runtime/main.ts` 改为：
```ts
import { Stage } from './stage'

declare global {
  interface Window {
    roachAPI: {
      setMouseIgnore(ignore: boolean): void
      onClearAll(cb: () => void): void
      quit(): void
    }
  }
}

const root = document.getElementById('stage')!
const stage = new Stage(root)

// 临时:每秒从屏幕中心生成一只，观察乱爬 + 出屏销毁
setInterval(() => {
  stage.spawn({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
}, 1000)

window.roachAPI.onClearAll(() => stage.clearAll())
export {}
```

- [ ] **Step 3: 构建并手动跑**

Run: `npm run dev`
Expected: 蟑螂不断从屏幕中央生成，各自随机乱爬、朝向跟随移动方向，爬出屏幕边缘后消失；生成约 30 只后不再增多（上限生效）。托盘「清空所有蟑螂」能一次清空。

- [ ] **Step 4: 提交**

```bash
git add -A && git commit -m "feat: 舞台 rAF 驱动 生成/乱爬/出屏销毁/上限/清空"
```

---

### Task 9: 墙洞——绘制、点击生成、拖动

**Files:**
- Create: `src/renderer/runtime/hole.ts`
- Create: `src/renderer/runtime/hole.css`
- Modify: `src/renderer/runtime/index.html`（引入 css）
- Modify: `src/renderer/runtime/main.ts`（挂墙洞、去掉临时定时器）

**Interfaces:**
- Produces:
  - `const HOLE_R = 36`（洞口命中半径 px）
  - `class Hole`
    - `constructor(root: HTMLElement, opts: { onPunch: (center: { x: number; y: number }) => void })`
    - `center(): { x: number; y: number }` —— 当前洞口中心（屏幕坐标）
    - 元素默认置于右下角，可拖动
- Consumes: 无（点击/拖动由 Task 10 的穿透接管保证可点，本任务元素 `pointer-events:auto`）。

- [ ] **Step 1: 写 `src/renderer/runtime/hole.css`**

```css
.hole {
  position: fixed;
  width: 72px;
  height: 72px;
  margin-left: -36px;
  margin-top: -36px;
  cursor: grab;
  pointer-events: auto;
}
.hole.dragging { cursor: grabbing; }
.hole.full { animation: hole-shake 0.3s; }
@keyframes hole-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
```

- [ ] **Step 2: 写 `src/renderer/runtime/hole.ts`**

墙洞用 SVG 画成墙面上的破洞（深色径向渐变洞口 + 碎裂边缘）。默认中心置于工作区右下角内缩 80px 处。拖动用 pointerdown/move/up。点击（未拖动）触发 `onPunch`。

```ts
export const HOLE_R = 36

const SVG = `
<svg width="72" height="72" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="holeg" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="#000" />
      <stop offset="70%" stop-color="#1a1a1a" />
      <stop offset="100%" stop-color="#4a4038" />
    </radialGradient>
  </defs>
  <path d="M36 6 L48 12 L60 10 L58 24 L66 34 L58 46 L62 60 L46 58 L36 66 L24 60 L10 62 L14 46 L6 34 L14 22 L12 10 L26 12 Z"
        fill="#6b5d4f" stroke="#463a2e" stroke-width="1.5" />
  <ellipse cx="36" cy="37" rx="24" ry="22" fill="url(#holeg)" />
</svg>`

export class Hole {
  private el: HTMLElement
  private cx = 0
  private cy = 0

  constructor(root: HTMLElement, private opts: { onPunch: (center: { x: number; y: number }) => void }) {
    this.el = document.createElement('div')
    this.el.className = 'hole'
    this.el.innerHTML = SVG
    root.appendChild(this.el)
    // 默认右下角内缩
    this.moveTo(window.innerWidth - 80, window.innerHeight - 80)
    this.bindDrag()
  }

  center(): { x: number; y: number } {
    return { x: this.cx, y: this.cy }
  }

  showFull(): void {
    this.el.classList.add('full')
    setTimeout(() => this.el.classList.remove('full'), 320)
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
      if (Math.abs(e.clientX - (this.cx + offX)) > 3 || Math.abs(e.clientY - (this.cy + offY)) > 3) {
        moved = true
      }
      this.moveTo(e.clientX - offX, e.clientY - offY)
    })
    this.el.addEventListener('pointerup', (e) => {
      dragging = false
      this.el.classList.remove('dragging')
      this.el.releasePointerCapture(e.pointerId)
      if (!moved) this.opts.onPunch(this.center())
    })
  }
}
```

- [ ] **Step 3: 在 HTML 引入 css**

在 `src/renderer/runtime/index.html` 的 `<head>` 内加：
```html
    <link rel="stylesheet" href="./hole.css" />
```

- [ ] **Step 4: 改 main.ts——挂墙洞，点洞生成蟑螂**

把 `src/renderer/runtime/main.ts` 改为：
```ts
import { Stage } from './stage'
import { Hole } from './hole'

declare global {
  interface Window {
    roachAPI: {
      setMouseIgnore(ignore: boolean): void
      onClearAll(cb: () => void): void
      quit(): void
    }
  }
}

const root = document.getElementById('stage')!
const stage = new Stage(root)
const hole = new Hole(root, {
  onPunch: (center) => {
    const ok = stage.spawn(center)
    if (!ok) hole.showFull()
  },
})

window.roachAPI.onClearAll(() => stage.clearAll())
export {}
```

- [ ] **Step 5: 构建并手动跑**（此时穿透未接管，全屏 pointer-events 情况：窗口默认穿透，但 dev 下 forward 仍会把事件送达 hole 元素？为稳妥本步用临时办法验证点击）

临时验证：在 `main.ts` 末尾临时加 `window.roachAPI.setMouseIgnore(false)`（让窗口整体接管点击，仅用于本步目检；Task 10 会删掉）。

Run: `npm run dev`
Expected: 右下角出现墙洞；点击墙洞钻出一只蟑螂并乱爬；可拖动墙洞到别处；连点到 30 只后墙洞抖动表示满了。目检后删除临时的 `setMouseIgnore(false)` 那行。

- [ ] **Step 6: 提交**

```bash
git add -A && git commit -m "feat: 墙洞 绘制/点击生成/拖动/满员抖动"
```

---

### Task 10: 鼠标穿透命中切换

**Files:**
- Modify: `src/renderer/runtime/main.ts`

**Interfaces:**
- Consumes: `hole.center()`、`HOLE_R`、`stage.roachRects()`、`pointInCircle`、`pointInRect`、`window.roachAPI.setMouseIgnore`。
- Produces: 全局 `mousemove` 监听——光标在墙洞或任一蟑螂命中区内则 `setMouseIgnore(false)`，否则 `setMouseIgnore(true)`；仅在状态变化时发 IPC。

- [ ] **Step 1: 改 main.ts 加入命中→穿透切换**

把 `src/renderer/runtime/main.ts` 改为：
```ts
import { Stage } from './stage'
import { Hole, HOLE_R } from './hole'
import { pointInCircle, pointInRect } from '../../core/geometry'

declare global {
  interface Window {
    roachAPI: {
      setMouseIgnore(ignore: boolean): void
      onClearAll(cb: () => void): void
      quit(): void
    }
  }
}

const root = document.getElementById('stage')!
const stage = new Stage(root)
const hole = new Hole(root, {
  onPunch: (center) => {
    const ok = stage.spawn(center)
    if (!ok) hole.showFull()
  },
})

window.roachAPI.onClearAll(() => stage.clearAll())

// 命中检测：光标在墙洞或蟑螂上 → 接管点击；否则穿透
let ignoring = true // 初始为穿透（与主进程默认一致）
function hitsInteractive(px: number, py: number): boolean {
  const c = hole.center()
  if (pointInCircle(px, py, c.x, c.y, HOLE_R)) return true
  for (const { rect } of stage.roachRects()) {
    if (pointInRect(px, py, rect)) return true
  }
  return false
}
window.addEventListener('mousemove', (e) => {
  const hit = hitsInteractive(e.clientX, e.clientY)
  const shouldIgnore = !hit
  if (shouldIgnore !== ignoring) {
    ignoring = shouldIgnore
    window.roachAPI.setMouseIgnore(shouldIgnore)
  }
})
export {}
```

- [ ] **Step 2: 构建并手动跑**

Run: `npm run dev`
Expected:
- 光标不在墙洞/蟑螂上时，可正常点击/操作桌面其他软件（穿透）。
- 光标移到墙洞上可点击生成蟑螂、可拖动。
- 光标移到爬动的蟑螂上时窗口接管点击（为 Task 11 拍死做准备）。

> 注意：`mousemove` 依赖主进程 `setIgnoreMouseEvents(true, { forward: true })` 的 forward 转发，Task 5 已设置。

- [ ] **Step 3: 提交**

```bash
git add -A && git commit -m "feat: 光标命中墙洞/蟑螂时切换鼠标穿透"
```

---

### Task 11: 拍死——打击特效 + 渐隐

**Files:**
- Create: `src/renderer/runtime/splat.ts`
- Create: `src/renderer/runtime/splat.css`
- Modify: `src/renderer/runtime/index.html`（引入 css）
- Modify: `src/renderer/runtime/cockroach.ts`（导出死亡动画时长常量）
- Modify: `src/renderer/runtime/stage.ts`（`killRoach` 播特效 + 压扁 + 渐隐后移除）
- Modify: `src/renderer/runtime/main.ts`（点击命中蟑螂 → killRoach）

**Interfaces:**
- Produces:
  - `function playSplat(root: HTMLElement, x: number, y: number): void` —— 在 (x,y) 播放冲击波扩散圈 + 碎点飞溅，动画结束自动移除自身 DOM。
  - `cockroach.ts` 新增 `export const DEATH_MS = 400`。
- Consumes: `playSplat`；`stage.killRoach` 改为：加 `.dying` 停止移动、加压扁+渐隐、`DEATH_MS` 后移除。

- [ ] **Step 1: 写 `src/renderer/runtime/splat.css`**

```css
.splat-shock {
  position: fixed;
  left: 0; top: 0;
  width: 20px; height: 20px;
  margin-left: -10px; margin-top: -10px;
  border: 2px solid rgba(120, 80, 50, 0.8);
  border-radius: 50%;
  pointer-events: none;
  animation: splat-shock 0.4s ease-out forwards;
}
@keyframes splat-shock {
  from { transform: scale(0.3); opacity: 0.9; }
  to   { transform: scale(3.2); opacity: 0; }
}
.splat-bit {
  position: fixed;
  left: 0; top: 0;
  width: 5px; height: 5px;
  margin-left: -2.5px; margin-top: -2.5px;
  background: #3a2418;
  border-radius: 50%;
  pointer-events: none;
  animation: splat-bit 0.4s ease-out forwards;
}
@keyframes splat-bit {
  from { transform: translate(0, 0); opacity: 1; }
  to   { transform: translate(var(--dx), var(--dy)); opacity: 0; }
}
.roach.fade { transition: opacity 0.28s ease-out; opacity: 0; }
```

- [ ] **Step 2: 写 `src/renderer/runtime/splat.ts`**

```ts
export function playSplat(root: HTMLElement, x: number, y: number): void {
  const shock = document.createElement('div')
  shock.className = 'splat-shock'
  shock.style.left = `${x}px`
  shock.style.top = `${y}px`
  root.appendChild(shock)
  shock.addEventListener('animationend', () => shock.remove())

  const N = 8
  for (let i = 0; i < N; i++) {
    const bit = document.createElement('div')
    bit.className = 'splat-bit'
    bit.style.left = `${x}px`
    bit.style.top = `${y}px`
    const ang = (i / N) * Math.PI * 2
    const dist = 18 + (i % 3) * 6
    bit.style.setProperty('--dx', `${Math.cos(ang) * dist}px`)
    bit.style.setProperty('--dy', `${Math.sin(ang) * dist}px`)
    root.appendChild(bit)
    bit.addEventListener('animationend', () => bit.remove())
  }
}
```

- [ ] **Step 3: 在 cockroach.ts 加死亡时长常量**

在 `src/renderer/runtime/cockroach.ts` 顶部加：
```ts
export const DEATH_MS = 400
```

- [ ] **Step 4: 在 HTML 引入 splat.css**

在 `src/renderer/runtime/index.html` 的 `<head>` 内加：
```html
    <link rel="stylesheet" href="./splat.css" />
```

- [ ] **Step 5: 改 stage.ts 的 killRoach 播特效**

在 `src/renderer/runtime/stage.ts` 顶部 import 追加：
```ts
import { createRoachEl, setRoachTransform, ROACH_W, ROACH_H, DEATH_MS } from './cockroach'
import { playSplat } from './splat'
```
把 `killRoach` 替换为：
```ts
  killRoach(id: number): void {
    const entry = this.roster.entries().find(([rid]) => rid === id)
    if (!entry) return
    const r = entry[1]
    if (r.dying) return
    r.dying = true
    playSplat(this.root, r.state.x, r.state.y)
    r.el.classList.add('dying') // 压扁（沿当前朝向）
    // 压扁定格片刻后渐隐
    setTimeout(() => r.el.classList.add('fade'), 120)
    setTimeout(() => {
      r.el.remove()
      this.roster.remove(id)
    }, DEATH_MS)
  }
```

- [ ] **Step 6: 改 main.ts——点击命中蟑螂则拍死**

在 `src/renderer/runtime/main.ts` 的 `window.roachAPI.onClearAll(...)` 之后加：
```ts
window.addEventListener('mousedown', (e) => {
  for (const { id, rect } of stage.roachRects()) {
    if (pointInRect(e.clientX, e.clientY, rect)) {
      stage.killRoach(id)
      break
    }
  }
})
```

- [ ] **Step 7: 构建并手动跑**

Run: `npm run dev`
Expected: 点中爬动的蟑螂 → 冲击波扩散圈 + 碎点飞溅，蟑螂压扁翻肚后渐隐消失；点空白处不误伤；墙洞照常生成。

- [ ] **Step 8: 提交**

```bash
git add -A && git commit -m "feat: 拍死 打击特效(冲击波+碎点)+压扁+渐隐"
```

---

### Task 12: 收尾——README 与整体验收

**Files:**
- Create: `README.md`

**Interfaces:** 无新接口，全链路验收。

- [ ] **Step 1: 写 README.md**

```markdown
# 桌面蟑螂 Desktop Cockroach 🪳

macOS 桌面小玩具：桌面常驻一个墙洞，点它钻出一只带爬行动效的蟑螂，随机满屏乱爬，跑出屏幕自动消失，点中则打击拍死。

## 运行

\`\`\`bash
npm install        # Electron 若被网络拦截见下
npm run dev        # 启动
npm test           # 跑核心纯逻辑单测
npm run build      # 构建到 out/
\`\`\`

Electron 二进制被网络拦截时：
\`\`\`bash
ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" node node_modules/electron/install.js
\`\`\`

## 玩法

- 右下角墙洞：点击钻出蟑螂（可反复点，最多同时 30 只），可拖动到任意位置。
- 蟑螂随机乱爬，朝向跟随移动方向，爬出屏幕自动销毁。
- 点中蟑螂 → 打击特效 + 拍死渐隐。
- 菜单栏 🪳 图标：清空所有蟑螂 / 退出。
- 平时鼠标穿透，不影响正常使用其他软件。

## 结构

- `src/core/` —— 纯逻辑（运动学 / 命中几何 / 数量花名册），Vitest 覆盖。
- `src/main/` —— Electron 主进程：透明置顶覆盖窗、鼠标穿透切换、托盘。
- `src/renderer/runtime/` —— 墙洞、蟑螂、舞台驱动、拍死特效。
\`\`\`

- [ ] **Step 2: 全链路手动验收**

Run: `npm run dev`
逐项确认 spec 成功标准：
1. 启动后无主窗口，右下角有墙洞，菜单栏有 🪳。
2. 平时鼠标穿透，不挡其他软件。
3. 点墙洞出带动效蟑螂，可反复点、多只并存、上限 30。
4. 蟑螂随机乱爬、朝向跟随移动，出屏销毁。
5. 点中蟑螂播放打击特效并渐隐。
6. 托盘可清空、可退出。

- [ ] **Step 3: 跑一遍全部单测**

Run: `npm test`
Expected: kinematics / geometry / roster 全 PASS。

- [ ] **Step 4: 提交**

```bash
git add -A && git commit -m "docs: README + 全链路验收"
```

---

## Self-Review 记录

- **Spec 覆盖：** 形态/无主窗(Task5)、托盘清空退出(Task6)、鼠标穿透默认+命中切换(Task5+10)、墙洞右下角/可拖/反复点(Task9)、上限30(Task4+8)、蟑螂SVG动效(Task7)、随机路径(Task2+8)、出屏销毁(Task8)、拍死打击+渐隐(Task11)、模块边界(core纯逻辑拆分) —— 全部有对应任务。
- **占位符：** 无 TBD/TODO；每步含完整代码或确切命令。
- **类型一致性：** `RoachState`/`Rect`/`Roster`/`spawn`/`roachRects`/`killRoach`/`Hole.center`/`HOLE_R`/`ROACH_W/H`/`DEATH_MS` 跨任务命名一致。
- **已知取舍：** DOM/Electron 接线用手动跑验证（非单测），纯核心走 TDD——符合 spec「core 为纯逻辑全覆盖」。
