// Camada de acesso a dados do renderer.
// Em Electron, usa a bridge `window.kyosk` (disco + watcher de pasta).
// No navegador (modo web/verificação), cai para `fetch` de arquivos estáticos.

import type { TotemConfig } from './types'

export interface KyoskBridge {
  getConfig(): Promise<TotemConfig>
  saveConfig(config: TotemConfig): Promise<{ ok: boolean; error?: string }>
  /** lista arquivos de mídia da pasta local (pasta-solta). */
  listMediaFiles(): Promise<string[]>
  /** notifica quando a pasta de mídia muda. */
  onMediaChanged(cb: () => void): void
  /** notifica quando a config muda no disco. */
  onConfigChanged(cb: () => void): void
  /** força uma sincronização remota agora (se configurada). */
  syncNow(): Promise<{ ok: boolean; error?: string }>
  isElectron: true
}

declare global {
  interface Window {
    kyosk?: KyoskBridge
    /** definidos pelo servidor do painel externo (LAN). */
    KYOSK_API?: string
    KYOSK_PANEL?: boolean
  }
}

export const bridge = (): KyoskBridge | null => window.kyosk ?? null

/** Base da API REST quando a UI é servida pelo painel externo; senão null. */
export const panelApi = (): string | null => window.KYOSK_API ?? null
export const isPanel = (): boolean => !!window.KYOSK_PANEL

let token = ''
try {
  token = localStorage.getItem('kyosk_token') ?? ''
} catch {
  /* sem storage */
}

export function setToken(t: string): void {
  token = t
  try {
    localStorage.setItem('kyosk_token', t)
  } catch {
    /* ignore */
  }
}

function authHeaders(): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Estado de autenticação do painel. */
export async function panelStatus(): Promise<{ online: boolean; needsPin: boolean } | null> {
  const api = panelApi()
  if (!api) return null
  const res = await fetch(`${api}/status`, { headers: authHeaders() })
  if (res.status === 401) return { online: true, needsPin: true }
  if (!res.ok) return null
  return (await res.json()) as { online: boolean; needsPin: boolean }
}

/** Autentica no painel com PIN; guarda o token. Retorna true se OK. */
export async function authenticate(pin: string): Promise<boolean> {
  const api = panelApi()
  if (!api) return false
  const res = await fetch(`${api}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin })
  })
  if (!res.ok) return false
  const j = (await res.json()) as { token: string }
  setToken(j.token)
  return true
}

export async function loadConfig(): Promise<TotemConfig> {
  const b = bridge()
  if (b) return b.getConfig()
  const api = panelApi()
  if (api) {
    const res = await fetch(`${api}/config`, { headers: authHeaders(), cache: 'no-store' })
    if (!res.ok) throw new Error(`Falha ao carregar config: ${res.status}`)
    return (await res.json()) as TotemConfig
  }
  const res = await fetch('./totem.config.json', { cache: 'no-store' })
  if (!res.ok) throw new Error(`Falha ao carregar config: ${res.status}`)
  return (await res.json()) as TotemConfig
}

export async function saveConfig(config: TotemConfig): Promise<void> {
  const b = bridge()
  if (b) {
    const r = await b.saveConfig(config)
    if (!r.ok) throw new Error(r.error ?? 'Falha ao salvar config')
    return
  }
  const api = panelApi()
  if (api) {
    const res = await fetch(`${api}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(config)
    })
    if (!res.ok) throw new Error(`Falha ao salvar: ${res.status}`)
    return
  }
  // Modo web puro: sem disco — devolve um download para não perder o trabalho.
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'totem.config.json'
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Descobre os itens de publicidade efetivos, combinando:
 *  - a pasta local (Electron: pasta-solta, ordena por nome de arquivo)
 *  - os itens declarados na config (ordem/ativo/duração explícitos)
 * A config vence quando um arquivo aparece nos dois lugares.
 */
export async function resolveAds(config: TotemConfig): Promise<TotemConfig['publicidade']['itens']> {
  const b = bridge()
  const declared = [...config.publicidade.itens]
  if (!b) return declared.filter((i) => i.ativo).sort((a, c) => a.ordem - c.ordem)

  const files = await b.listMediaFiles()
  const declaredByFile = new Map(declared.map((i) => [normalize(i.arquivo), i]))
  const merged = [...declared]
  let nextOrder = declared.length
  for (const f of files) {
    if (declaredByFile.has(normalize(f))) continue
    merged.push({
      id: `auto-${f}`,
      tipo: isVideo(f) ? 'video' : 'image',
      arquivo: f,
      ordem: nextOrder++,
      ativo: true
    })
  }
  return merged.filter((i) => i.ativo).sort(byOrderThenName)
}

function byOrderThenName(
  a: TotemConfig['publicidade']['itens'][number],
  c: TotemConfig['publicidade']['itens'][number]
): number {
  if (a.ordem !== c.ordem) return a.ordem - c.ordem
  return a.arquivo.localeCompare(c.arquivo, undefined, { numeric: true })
}

function normalize(p: string): string {
  return p.replace(/^\.?\//, '').replace(/\\/g, '/').toLowerCase()
}

export function isVideo(path: string): boolean {
  return /\.(mp4|webm|mov|m4v|ogv)$/i.test(path)
}
