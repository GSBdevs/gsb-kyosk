import { app, BrowserWindow, ipcMain, protocol, net } from 'electron'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve, relative } from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, watch } from 'node:fs'
import {
  dataDir,
  configPath,
  mediaDir,
  syncConfigPath,
  readConfigRaw,
  writeConfigRaw,
  listMediaRelative,
  rewritePaths
} from './store'
import { startPanelServer, type PanelHandle } from './panel-server'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged
const SCHEME = 'kyosk'

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
])

let win: BrowserWindow | null = null
let panel: PanelHandle | null = null

// ===== Sync opcional (local-first) =====
interface SyncConfig {
  enabled: boolean
  configUrl?: string
  intervalMin?: number
}

function readSyncConfig(): SyncConfig {
  const p = syncConfigPath()
  if (!existsSync(p)) return { enabled: false }
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as SyncConfig
  } catch {
    return { enabled: false }
  }
}

async function syncNow(): Promise<{ ok: boolean; error?: string }> {
  const cfg = readSyncConfig()
  if (!cfg.enabled || !cfg.configUrl) return { ok: false, error: 'sync desativado' }
  try {
    const res = await fetch(cfg.configUrl, { cache: 'no-store' as RequestCache })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const remote = await res.json()
    if (!remote || typeof remote !== 'object' || !('estabelecimento' in remote)) {
      return { ok: false, error: 'config remota inválida' }
    }
    const p = configPath()
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, JSON.stringify(remote, null, 2), 'utf-8')
    win?.webContents.send('kyosk:configChanged')
    // TODO(próximo incremento): baixar mídia referenciada para midia/ e servir offline.
    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1080,
    height: 1920,
    fullscreen: !isDev,
    kiosk: !isDev,
    backgroundColor: '#0b1b33',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Serve arquivos do dataDir sob kyosk://app/<relpath>, sem sair da pasta.
  protocol.handle(SCHEME, (request) => {
    const url = new URL(request.url)
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '')
    const target = resolve(dataDir(), rel)
    if (relative(dataDir(), target).startsWith('..')) {
      return new Response('Forbidden', { status: 403 })
    }
    return net.fetch(pathToFileURL(target).toString())
  })

  // IPC (editor embutido). Caminhos de mídia/asset viram kyosk://app/...
  ipcMain.handle('kyosk:getConfig', () => rewritePaths(readConfigRaw(), `${SCHEME}://app/`))
  ipcMain.handle('kyosk:saveConfig', (_e, config: unknown) => {
    try {
      writeConfigRaw(config)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })
  ipcMain.handle('kyosk:listMediaFiles', () => listMediaRelative().map((r) => `${SCHEME}://app/${r}`))
  ipcMain.handle('kyosk:syncNow', () => syncNow())

  // Watchers → recarga ao vivo (cobre tanto o editor embutido quanto o painel externo).
  const notify = (channel: string): void => {
    win?.webContents.send(channel)
  }
  try {
    if (existsSync(mediaDir())) watch(mediaDir(), () => notify('kyosk:mediaChanged'))
    if (existsSync(dirname(configPath()))) {
      watch(dirname(configPath()), (_ev, f) => {
        if (f === 'totem.config.json') notify('kyosk:configChanged')
      })
    }
  } catch {
    /* watch é best-effort */
  }

  createWindow()

  // Painel externo local (LAN), se habilitado em config/panel.json.
  panel = startPanelServer(() => win)

  // Sync opcional.
  const sync = readSyncConfig()
  if (sync.enabled && sync.configUrl) {
    void syncNow()
    const min = Math.max(1, sync.intervalMin ?? 30)
    setInterval(() => void syncNow(), min * 60_000)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  panel?.stop()
  if (process.platform !== 'darwin') app.quit()
})
