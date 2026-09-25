import { contextBridge, ipcRenderer } from 'electron'

const api = {
  isElectron: true as const,
  getConfig: () => ipcRenderer.invoke('kyosk:getConfig'),
  saveConfig: (config: unknown) => ipcRenderer.invoke('kyosk:saveConfig', config),
  listMediaFiles: () => ipcRenderer.invoke('kyosk:listMediaFiles'),
  syncNow: () => ipcRenderer.invoke('kyosk:syncNow'),
  onMediaChanged: (cb: () => void) => {
    ipcRenderer.on('kyosk:mediaChanged', () => cb())
  },
  onConfigChanged: (cb: () => void) => {
    ipcRenderer.on('kyosk:configChanged', () => cb())
  }
}

contextBridge.exposeInMainWorld('kyosk', api)
