import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'

export interface DisplayInfo {
  id: number
  x: number // 全局 DIP 坐标（用 bounds，跨屏坐标连续）
  y: number
  width: number
  height: number
  isPrimary: boolean
}

export function allDisplayInfos(): DisplayInfo[] {
  const primaryId = screen.getPrimaryDisplay().id
  return screen.getAllDisplays().map((d) => ({
    id: d.id,
    x: d.bounds.x,
    y: d.bounds.y,
    width: d.bounds.width,
    height: d.bounds.height,
    isPrimary: d.id === primaryId,
  }))
}

export function createOverlayWindow(info: DisplayInfo): BrowserWindow {
  const win = new BrowserWindow({
    x: info.x,
    y: info.y,
    width: info.width,
    height: info.height,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true, // 【测试：验证 focusable 是否影响自定义光标】
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.setBounds({ x: info.x, y: info.y, width: info.width, height: info.height })
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
