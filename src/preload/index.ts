import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('roachAPI', {
  setMouseIgnore: (ignore: boolean) => ipcRenderer.send('roach:setMouseIgnore', ignore),
  onClearAll: (cb: () => void) => ipcRenderer.on('roach:clearAll', () => cb()),
  getSelfInfo: () => ipcRenderer.sendSync('roach:getSelfInfo'),
  migrate: (state: unknown) => ipcRenderer.send('roach:migrate', state),
  onAccept: (cb: (state: unknown) => void) =>
    ipcRenderer.on('roach:accept', (_e, state) => cb(state)),
  holeDrag: (g: { x: number; y: number }) => ipcRenderer.send('roach:holeDrag', g),
  holeDrop: (g: { x: number; y: number }) => ipcRenderer.send('roach:holeDrop', g),
  onGhostHole: (cb: (p: { x: number; y: number } | null) => void) =>
    ipcRenderer.on('roach:ghostHole', (_e, p) => cb(p)),
  onSetHoleOwner: (cb: (p: { x: number; y: number } | null) => void) =>
    ipcRenderer.on('roach:setHoleOwner', (_e, p) => cb(p)),
  onSetSpawnMode: (cb: (mode: 'click' | 'timed' | 'random') => void) =>
    ipcRenderer.on('roach:setSpawnMode', (_e, mode) => cb(mode)),
  onSetSpawnInterval: (cb: (ms: number) => void) =>
    ipcRenderer.on('roach:setSpawnInterval', (_e, ms) => cb(ms)),
  quit: () => ipcRenderer.send('roach:quit'),
})
