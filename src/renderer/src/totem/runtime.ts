// Runtime do totem: monta header + grade de cards + faixa de publicidade a partir da config.

import type { Card, Locale, TotemConfig } from '../types'
import { resolveAds } from '../config-source'
import { flagCode, t } from '../i18n'
import { createAds, type AdsController } from './ads'
import { iconSvg, isImagePath } from './icons'

export interface RuntimeHandle {
  destroy(): void
}

export async function mountRuntime(host: HTMLElement, config: TotemConfig): Promise<RuntimeHandle> {
  host.innerHTML = ''
  let locale: Locale = config.estabelecimento.idiomas[0] ?? 'pt-BR'
  let ads: AdsController | null = null

  applyTheme(config)

  const root = document.createElement('div')
  root.className = 'totem'
  const bg = config.estabelecimento.tema.fundoImagem
  if (bg) root.style.backgroundImage = `url("${bg}")`

  const bgVideo = config.estabelecimento.tema.fundoVideo
  if (bgVideo) {
    const v = document.createElement('video')
    v.className = 'totem__bg-video'
    v.src = bgVideo
    v.muted = true
    v.loop = true
    v.autoplay = true
    v.playsInline = true
    void v.play().catch(() => undefined)
    root.appendChild(v)
  }

  const header = document.createElement('header')
  header.className = 'totem__header'
  if (config.estabelecimento.logo) {
    const logo = document.createElement('img')
    logo.className = 'totem__logo'
    logo.src = config.estabelecimento.logo
    logo.alt = t(config.estabelecimento.nome, locale)
    header.appendChild(logo)
  }
  const langs = document.createElement('div')
  langs.className = 'totem__langs'
  header.appendChild(langs)
  root.appendChild(header)

  const body = document.createElement('main')
  body.className = 'totem__body'
  const grid = document.createElement('div')
  grid.className = 'grid'
  body.appendChild(grid)
  root.appendChild(body)

  const adsHost = document.createElement('div')
  root.appendChild(adsHost)

  host.appendChild(root)

  function renderLangs(): void {
    langs.innerHTML = ''
    if (config.estabelecimento.idiomas.length < 2) return
    for (const lc of config.estabelecimento.idiomas) {
      const b = document.createElement('button')
      b.className = 'totem__lang'
      b.setAttribute('aria-pressed', String(lc === locale))
      b.title = lc
      const img = document.createElement('img')
      img.src = `https://flagcdn.com/32x24/${flagCode(lc)}.png`
      img.alt = lc
      b.appendChild(img)
      b.addEventListener('click', () => {
        locale = lc
        renderLangs()
        renderCards()
      })
      langs.appendChild(b)
    }
  }

  function renderCards(): void {
    const { grid: g, cards } = config.layout
    const ativos = cards.filter((c) => c.ativo)
    const manual = g.modo === 'manual'
    grid.style.setProperty('--gap-cards', `${g.gap ?? 22}px`)
    grid.style.gridTemplateRows = ''

    if (manual) {
      grid.style.gridTemplateColumns = `repeat(${g.cols}, minmax(0, 1fr))`
      grid.style.gridTemplateRows = `repeat(${g.rows}, clamp(130px, 18vh, 240px))`
    } else {
      // AUTO: colunas derivadas da quantidade de cards → layout responsivo.
      const cols = autoCols(ativos.length, g.cols)
      grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`
      grid.style.gridAutoRows = 'clamp(130px, 18vh, 240px)'
      grid.style.maxWidth = `${Math.min(1120, 300 + cols * 240)}px`
    }

    grid.innerHTML = ''
    for (const card of ativos) grid.appendChild(renderCard(card, manual))
  }

  // Colunas ideais para N cards (teto configurável), pensado para totem retrato.
  function autoCols(n: number, teto: number): number {
    const max = Math.max(1, teto || 4)
    const tabela: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 3 }
    const cols = tabela[n] ?? Math.ceil(Math.sqrt(n))
    return Math.min(cols, max)
  }

  function renderCard(card: Card, manual: boolean): HTMLElement {
    const el = document.createElement('button')
    el.className = 'card'
    if (manual && card.pos) {
      el.style.gridColumn = String(card.pos.col)
      el.style.gridRow = String(card.pos.row)
    }
    if (card.cor) el.style.background = card.cor

    const chip = document.createElement('div')
    chip.className = 'card__chip'
    if (isImagePath(card.icone)) {
      const img = document.createElement('img')
      img.className = 'card__icon'
      img.src = card.icone as string
      img.alt = ''
      chip.appendChild(img)
    } else {
      const span = document.createElement('span')
      span.innerHTML = iconSvg(card.icone)
      chip.appendChild(span.firstElementChild as HTMLElement)
    }
    el.appendChild(chip)

    const title = document.createElement('span')
    title.className = 'card__title'
    title.textContent = t(card.titulo, locale)
    el.appendChild(title)

    el.addEventListener('click', () => handleAction(card))
    return el
  }

  function handleAction(card: Card): void {
    const { tipo, destino } = card.acao
    const modo = card.abertura ?? 'modal'
    let titulo = t(card.titulo, locale)
    let html = ''
    switch (tipo) {
      case 'tela': {
        const tela = config.telas.find((s) => s.id === destino)
        titulo = tela ? t(tela.titulo, locale) : titulo
        html = renderTelaContent(tela)
        break
      }
      case 'url':
        html = urlNotice(destino)
        break
      case 'pix':
        html = pixNotice(destino)
        break
      case 'pdf':
        html = `<p>PDF: ${escapeHtml(destino)}</p>`
        break
      case 'galeria':
        html = `<p>Galeria: ${escapeHtml(destino)}</p>`
        break
    }
    openContent(titulo, html, modo)
  }

  function renderTelaContent(tela: TotemConfig['telas'][number] | undefined): string {
    if (!tela) return '<p>Conteúdo não configurado.</p>'
    const c = tela.conteudo as Record<string, unknown>
    switch (tela.tipo) {
      case 'texto':
        return `<p>${escapeHtml(String(c.texto ?? ''))}</p>`
      case 'contato':
        return `<p>Telefone: ${escapeHtml(String(c.telefone ?? '—'))}</p>
                <p>E-mail: ${escapeHtml(String(c.email ?? '—'))}</p>
                <p>Endereço: ${escapeHtml(String(c.endereco ?? '—'))}</p>`
      case 'lista':
      case 'horarios': {
        const itens = Array.isArray(c.itens) ? (c.itens as unknown[]) : []
        if (!itens.length) return '<p>Nada cadastrado ainda.</p>'
        return `<ul>${itens.map((i) => `<li>${escapeHtml(String(i))}</li>`).join('')}</ul>`
      }
      default:
        return `<pre>${escapeHtml(JSON.stringify(c, null, 2))}</pre>`
    }
  }

  // --- Modal (janela central) ---
  const overlay = document.createElement('div')
  overlay.className = 'overlay'
  overlay.style.display = 'none'
  overlay.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet__head">
        <h2 class="sheet__title"></h2>
        <button class="sheet__close" aria-label="Fechar">✕</button>
      </div>
      <div class="sheet__content"></div>
    </div>`
  const closeOverlay = (): void => {
    overlay.style.display = 'none'
  }
  overlay.querySelector('.sheet__close')!.addEventListener('click', closeOverlay)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeOverlay()
  })
  host.appendChild(overlay)

  // --- Página (tela inteira) ---
  const page = document.createElement('div')
  page.className = 'page'
  page.style.display = 'none'
  page.innerHTML = `<header class="page__head">
      <button class="page__back" aria-label="Voltar">‹ Voltar</button>
      <h2 class="page__title"></h2>
    </header>
    <div class="page__content"></div>`
  const closePage = (): void => {
    page.style.display = 'none'
  }
  page.querySelector('.page__back')!.addEventListener('click', closePage)
  host.appendChild(page)

  function openContent(title: string, html: string, modo: 'modal' | 'pagina'): void {
    if (modo === 'pagina') {
      page.querySelector('.page__title')!.textContent = title
      page.querySelector('.page__content')!.innerHTML = html
      page.style.display = 'flex'
    } else {
      overlay.querySelector('.sheet__title')!.textContent = title
      overlay.querySelector('.sheet__content')!.innerHTML = html
      overlay.style.display = 'flex'
    }
  }

  async function renderAds(): Promise<void> {
    ads?.destroy()
    const itens = await resolveAds(config)
    ads = createAds(config.publicidade, itens)
    adsHost.replaceChildren(ads.el)
  }

  renderLangs()
  renderCards()
  await renderAds()

  return {
    destroy() {
      ads?.destroy()
      host.innerHTML = ''
    }
  }
}

function applyTheme(config: TotemConfig): void {
  const tema = config.estabelecimento.tema
  const r = document.documentElement.style
  if (tema.corPrimaria) r.setProperty('--cor-primaria', tema.corPrimaria)
  if (tema.corCard) r.setProperty('--cor-card', tema.corCard)
  if (tema.corTextoCard) r.setProperty('--cor-texto-card', tema.corTextoCard)
  if (tema.corFundo) r.setProperty('--cor-fundo', tema.corFundo)
  if (tema.corAcento) r.setProperty('--cor-acento', tema.corAcento)
  if (tema.raio) r.setProperty('--raio', tema.raio)
  if (config.layout.grid.gap != null) r.setProperty('--gap-cards', `${config.layout.grid.gap}px`)
  const altura = config.publicidade.alturaVh
  if (altura != null) r.setProperty('--ads-altura', `${altura}vh`)
}

function urlNotice(url: string): string {
  return `<p>Abrir link:</p><p><strong>${escapeHtml(url)}</strong></p>
    <p style="opacity:.7">No totem, abrirá em navegador embutido.</p>`
}

function pixNotice(chave: string): string {
  return `<p>Pague com Pix usando a chave:</p><p><strong>${escapeHtml(chave)}</strong></p>
    <p style="opacity:.7">O QR Code será exibido aqui no totem.</p>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  )
}
