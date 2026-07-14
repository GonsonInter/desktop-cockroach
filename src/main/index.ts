import { app, ipcMain, BrowserWindow } from 'electron'
import { createOverlayWindow, allDisplayInfos, DisplayInfo } from './window'
import { createTray } from './tray'

const wins = new Map<number, BrowserWindow>() // displayId → 窗口
const infoByWc = new Map<number, DisplayInfo>() // webContents.id → 该窗口负责的屏
let layout: DisplayInfo[] = []

app.whenReady().then(() => {
  layout = allDisplayInfos()
  for (const info of layout) {
    const win = createOverlayWindow(info)
    wins.set(info.id, win)
    infoByWc.set(win.webContents.id, info)
  }

  createTray({
    onClearAll: () => wins.forEach((w) => w.webContents.send('roach:clearAll')),
    onSetSpawnMode: (mode) => wins.forEach((w) => w.webContents.send('roach:setSpawnMode', mode)),
    onSetSpawnInterval: (ms) => wins.forEach((w) => w.webContents.send('roach:setSpawnInterval', ms)),
  })

  ipcMain.on('roach:setMouseIgnore', (e, ignore: boolean) => {
    BrowserWindow.fromWebContents(e.sender)?.setIgnoreMouseEvents(ignore, { forward: true })
  })

  // 渲染层查询自己负责哪块屏（全局坐标、是否主屏）
  ipcMain.on('roach:getSelfInfo', (e) => {
    e.returnValue = infoByWc.get(e.sender.id) ?? null
  })

  // 蟑螂离开某屏 → 按全局坐标找到目标屏，转发给对应窗口继续爬；无目标屏则销毁
  ipcMain.on('roach:migrate', (_e, state: { x: number; y: number }) => {
    const target = layout.find(
      (d) => state.x >= d.x && state.x < d.x + d.width && state.y >= d.y && state.y < d.y + d.height,
    )
    if (target) wins.get(target.id)?.webContents.send('roach:accept', state)
  })

  // 墙洞跨屏拖动：主进程按全局坐标路由虚影 / 移交属主窗口
  let holeOwnerId = (layout.find((d) => d.isPrimary) ?? layout[0]).id
  let ghostWinId: number | null = null
  const screenAt = (gx: number, gy: number) =>
    layout.find((d) => gx >= d.x && gx < d.x + d.width && gy >= d.y && gy < d.y + d.height)

  ipcMain.on('roach:holeDrag', (_e, g: { x: number; y: number }) => {
    const scr = screenAt(g.x, g.y)
    const targetId = scr && scr.id !== holeOwnerId ? scr.id : null // 虚影只在非属主屏显示
    if (ghostWinId !== null && ghostWinId !== targetId) {
      wins.get(ghostWinId)?.webContents.send('roach:ghostHole', null)
    }
    ghostWinId = targetId
    if (targetId !== null && scr) {
      wins.get(targetId)?.webContents.send('roach:ghostHole', { x: g.x - scr.x, y: g.y - scr.y })
    }
  })

  ipcMain.on('roach:holeDrop', (_e, g: { x: number; y: number }) => {
    if (ghostWinId !== null) {
      wins.get(ghostWinId)?.webContents.send('roach:ghostHole', null)
      ghostWinId = null
    }
    const scr = screenAt(g.x, g.y) ?? layout.find((d) => d.id === holeOwnerId)!
    wins.forEach((w, id) => {
      if (id === scr.id) w.webContents.send('roach:setHoleOwner', { x: g.x - scr.x, y: g.y - scr.y })
      else w.webContents.send('roach:setHoleOwner', null)
    })
    holeOwnerId = scr.id
  })

  ipcMain.on('roach:quit', () => app.quit())
})

app.on('window-all-closed', () => {
  // 常驻托盘，不随窗口关闭退出
})
