import { Tray, Menu, nativeImage, app } from 'electron'

export function createTray(opts: {
  onClearAll: () => void
  onSetSpawnMode: (mode: 'click' | 'timed' | 'random') => void
  onSetSpawnInterval: (ms: number) => void
}): Tray {
  const tray = new Tray(nativeImage.createEmpty())
  tray.setTitle('🪳')

  let mode: 'click' | 'timed' | 'random' = 'click'
  let intervalMs = 3000
  const intervals = [1000, 2000, 3000, 5000, 10000]

  function rebuild() {
    const menu = Menu.buildFromTemplate([
      { label: '产出方式', enabled: false },
      {
        label: '点击墙洞产出',
        type: 'radio',
        checked: mode === 'click',
        click: () => {
          mode = 'click'
          opts.onSetSpawnMode('click')
          rebuild()
        },
      },
      {
        label: mode === 'timed' ? '定时自动产出 ✓' : '定时自动产出',
        submenu: intervals.map((ms) => ({
          label: `每 ${ms / 1000} 秒`,
          type: 'radio' as const,
          checked: mode === 'timed' && intervalMs === ms,
          click: () => {
            mode = 'timed'
            intervalMs = ms
            opts.onSetSpawnInterval(ms)
            opts.onSetSpawnMode('timed')
            rebuild()
          },
        })),
      },
      {
        label: '随机自动产出',
        type: 'radio',
        checked: mode === 'random',
        click: () => {
          mode = 'random'
          opts.onSetSpawnMode('random')
          rebuild()
        },
      },
      { type: 'separator' },
      { label: '清空所有蟑螂', click: () => opts.onClearAll() },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() },
    ])
    tray.setContextMenu(menu)
  }

  rebuild()
  return tray
}
