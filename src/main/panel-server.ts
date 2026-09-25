// Servidor HTTP local (LAN) do painel externo — Fase 1.
// Serve a UI do painel (bundle do renderer, com flag injetada), os arquivos de dados
// em /files/, e a API REST /api/* protegida por PIN. Zero dependências (http nativo).

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { networkInterfaces } from 'node:os'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, resolve, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BrowserWindow } from 'electron'
import {
  dataDir,
  configPath,
  readConfigRaw,
  writeConfigRaw,
  listMediaRelative,
  rewritePaths,
  readPanelConfig,
  editorPin,
  MEDIA_EXT
} from './store'

const __dirname = dirname(fileURLToPath(import.meta.url))

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2'
}

/** Diretório do bundle do renderer (serve como UI do painel). */
function rendererDir(): string {
  return resolve(__dirname, '..', 'renderer')
}

function send(res: ServerResponse, status: number, body: string | Buffer, type = 'text/plain'): void {
  res.writeHead(status, { 'Content-Type': type })
  res.end(body)
}

function sendJson(res: ServerResponse, status: number, obj: unknown): void {
  send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8')
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    let data = ''
    req.on('data', (c) => {
      data += c
      if (data.length > 8_000_000) reject(new Error('payload grande demais'))
    })
    req.on('end', () => resolveBody(data))
    req.on('error', reject)
  })
}

function localIps(): string[] {
  const out: string[] = []
  const nets = networkInterfaces()
  for (const list of Object.values(nets)) {
    for (const ni of list ?? []) {
      if (ni.family === 'IPv4' && !ni.internal) out.push(ni.address)
    }
  }
  return out
}

export interface PanelHandle {
  urls: string[]
  stop: () => void
}

export function startPanelServer(getWin: () => BrowserWindow | null): PanelHandle | null {
  const cfg = readPanelConfig()
  if (!cfg.enabled) return null

  const tokens = new Set<string>()
  const requiredPin = (cfg.token && cfg.token.trim()) || editorPin()

  const authOk = (req: IncomingMessage): boolean => {
    if (!requiredPin) return true // sem PIN configurado → painel aberto na LAN
    const h = req.headers['authorization'] ?? ''
    const tok = h.replace(/^Bearer\s+/i, '').trim()
    return tokens.has(tok)
  }

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const path = decodeURIComponent(url.pathname)

      // --- API ---
      if (path === '/api/auth' && req.method === 'POST') {
        const body = JSON.parse((await readBody(req)) || '{}') as { pin?: string }
        if (!requiredPin || body.pin === requiredPin) {
          const token = randomUUID()
          tokens.add(token)
          return sendJson(res, 200, { token, needsPin: !!requiredPin })
        }
        return sendJson(res, 401, { error: 'PIN incorreto' })
      }

      // Flags do painel — servidas como arquivo JS de mesma origem (o CSP bloqueia inline).
      if (path === '/__panel.js') {
        return send(
          res,
          200,
          `window.KYOSK_API='/api';window.KYOSK_FILES='/files';window.KYOSK_PANEL=true;`,
          'text/javascript; charset=utf-8'
        )
      }

      if (path.startsWith('/api/')) {
        if (!authOk(req)) return sendJson(res, 401, { error: 'não autorizado' })

        if (path === '/api/status' && req.method === 'GET') {
          const mtime = existsSync(configPath()) ? statSync(configPath()).mtime.toISOString() : null
          return sendJson(res, 200, { online: true, ultimaEdicao: mtime, needsPin: !!requiredPin })
        }
        if (path === '/api/config' && req.method === 'GET') {
          return sendJson(res, 200, rewritePaths(readConfigRaw(), '/files/'))
        }
        if (path === '/api/config' && req.method === 'PUT') {
          const body = JSON.parse((await readBody(req)) || '{}')
          writeConfigRaw(body)
          getWin()?.webContents.send('kyosk:configChanged')
          return sendJson(res, 200, { ok: true })
        }
        if (path === '/api/media' && req.method === 'GET') {
          const itens = listMediaRelative().map((rel) => ({
            nome: rel.split('/').pop(),
            url: '/files/' + rel,
            tipo: /\.(mp4|webm|mov|m4v|ogv)$/i.test(rel) ? 'video' : 'image'
          }))
          return sendJson(res, 200, itens)
        }
        return sendJson(res, 404, { error: 'rota não encontrada' })
      }

      // --- Arquivos de dados (/files/...) ---
      if (path.startsWith('/files/')) {
        const rel = path.slice('/files/'.length)
        const target = resolve(dataDir(), rel)
        if (relative(dataDir(), target).startsWith('..') || !existsSync(target)) {
          return send(res, 404, 'not found')
        }
        if (MEDIA_EXT.test(target) || /\.(json|css|js)$/i.test(target)) {
          return send(res, 200, readFileSync(target), MIME[extname(target).toLowerCase()] ?? 'application/octet-stream')
        }
        return send(res, 403, 'forbidden')
      }

      // --- UI do painel (bundle do renderer) ---
      return serveRenderer(path, res)
    } catch (err) {
      return sendJson(res, 500, { error: (err as Error).message })
    }
  })

  server.on('error', (e) => console.error('[painel] erro do servidor:', e.message))
  server.listen(cfg.port, '0.0.0.0')

  const urls = localIps().map((ip) => `http://${ip}:${cfg.port}`)
  console.log('[painel] disponível em:', urls.join(', ') || `http://localhost:${cfg.port}`)
  return { urls, stop: () => server.close() }
}

/** Serve o index.html (com flag de painel injetada) e os assets do renderer. */
function serveRenderer(path: string, res: ServerResponse): void {
  const dir = rendererDir()
  if (path === '/' || path === '/index.html') {
    const idx = join(dir, 'index.html')
    if (!existsSync(idx)) {
      return send(res, 503, 'Painel indisponível: bundle do renderer não encontrado (rode o build).')
    }
    let html = readFileSync(idx, 'utf-8')
    // Injeta o modo painel via arquivo externo (mesma origem) — compatível com o CSP.
    // Classic script roda durante o parse, antes do módulo (deferido) do app.
    html = html.replace('</head>', `<script src="/__panel.js"></script></head>`)
    return send(res, 200, html, 'text/html; charset=utf-8')
  }
  const target = resolve(dir, path.replace(/^\/+/, ''))
  if (relative(dir, target).startsWith('..') || !existsSync(target)) {
    return send(res, 404, 'not found')
  }
  return send(res, 200, readFileSync(target), MIME[extname(target).toLowerCase()] ?? 'application/octet-stream')
}
