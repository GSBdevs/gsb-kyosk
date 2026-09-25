// Camada de dados única do totem — usada pelos handlers IPC (editor embutido)
// E pelas rotas HTTP (painel externo na LAN). Fonte da verdade: arquivos no disco.

import { app } from 'electron'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

export const MEDIA_EXT = /\.(png|jpe?g|webp|gif|svg|mp4|webm|mov|m4v|ogv)$/i

/** Diretório de dados editável (config + mídia). Dev: raiz do projeto. Prod: ao lado do .exe. */
export function dataDir(): string {
  if (isDev) return resolve(__dirname, '..', '..')
  return dirname(app.getPath('exe'))
}

export function configPath(): string {
  return join(dataDir(), 'config', 'totem.config.json')
}

export function mediaDir(): string {
  return join(dataDir(), 'midia', 'publicidade')
}

export function syncConfigPath(): string {
  return join(dataDir(), 'config', 'sync.json')
}

export function panelConfigPath(): string {
  return join(dataDir(), 'config', 'panel.json')
}

/** Lê a config crua (caminhos relativos "./..."). */
export function readConfigRaw(): Record<string, unknown> {
  const p = configPath()
  const raw = readFileSync(p, 'utf-8')
  return JSON.parse(raw) as Record<string, unknown>
}

/** Grava a config, normalizando caminhos de qualquer transporte de volta para "./...". */
export function writeConfigRaw(config: unknown): void {
  const p = configPath()
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(normalizeForDisk(config), null, 2), 'utf-8')
}

/** Lista a mídia da pasta como caminhos relativos ("midia/publicidade/x.svg"). */
export function listMediaRelative(): string[] {
  const dir = mediaDir()
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => MEDIA_EXT.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((f) => `midia/publicidade/${f}`)
}

/** Converte caminhos de exibição (kyosk://app/... ou /files/...) de volta para "./...". */
export function normalizeForDisk<T>(value: T): T {
  if (typeof value === 'string') {
    const m = value.match(/^(?:kyosk:\/\/app\/|\/files\/)(.+)$/)
    if (m) return ('./' + m[1]) as unknown as T
    return value
  }
  if (Array.isArray(value)) return value.map((v) => normalizeForDisk(v)) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = normalizeForDisk(v)
    return out as T
  }
  return value
}

/** Reescreve caminhos "./midia|assets|config/..." para um prefixo de transporte. */
export function rewritePaths<T>(value: T, prefix: string): T {
  if (typeof value === 'string') {
    const m = value.replace(/^\.?\//, '')
    if (/^(midia|assets|config)\//i.test(m)) return (prefix + m) as unknown as T
    return value
  }
  if (Array.isArray(value)) return value.map((v) => rewritePaths(v, prefix)) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = rewritePaths(v, prefix)
    return out as T
  }
  return value
}

export interface PanelConfig {
  enabled: boolean
  port: number
  token?: string
}

export function readPanelConfig(): PanelConfig {
  const p = panelConfigPath()
  if (!existsSync(p)) return { enabled: false, port: 8787 }
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf-8')) as Partial<PanelConfig>
    return { enabled: parsed.enabled ?? false, port: parsed.port ?? 8787, token: parsed.token }
  } catch {
    return { enabled: false, port: 8787 }
  }
}

/** PIN do editor (credencial do painel), lido da config de conteúdo. */
export function editorPin(): string {
  try {
    const c = readConfigRaw()
    return typeof c.editorPin === 'string' ? c.editorPin.trim() : ''
  } catch {
    return ''
  }
}
