// Editor (mesmo app, outro modo). v1: reordenação drag-drop e ativar/desativar da
// publicidade, edição básica de cards e salvar. Compartilha a config com o runtime.

import type { TotemConfig } from '../types'
import { saveConfig } from '../config-source'
import { t } from '../i18n'
import { PRESETS } from '../presets'
import './editor.css'

export interface EditorHandle {
  destroy(): void
}

export function mountEditor(
  host: HTMLElement,
  config: TotemConfig,
  onExit: (updated: TotemConfig) => void
): EditorHandle {
  let draft: TotemConfig = structuredClone(config)
  const locale = (): string => draft.estabelecimento.idiomas[0] ?? 'pt-BR'

  host.innerHTML = ''
  const root = document.createElement('div')
  root.className = 'editor'
  root.innerHTML = `
    <header class="editor__bar">
      <strong>Editor — SB Kyosk</strong>
      <label class="editor__preset">Modelo:
        <select id="preset-select">
          <option value="">— aplicar modelo —</option>
          ${PRESETS.map((p) => `<option value="${p.id}">${escapeHtml(p.nome)}</option>`).join('')}
        </select>
      </label>
      <span class="editor__spacer"></span>
      <button class="editor__btn" data-act="save">Salvar</button>
      <button class="editor__btn editor__btn--ghost" data-act="exit">Voltar ao totem</button>
    </header>
    <div class="editor__cols">
      <section class="editor__panel">
        <h3>Publicidade (arraste para reordenar)</h3>
        <ul class="ad-list" id="ad-list"></ul>
        <p class="editor__hint">Arquivos soltos na pasta <code>midia/publicidade/</code> também aparecem no totem.</p>
      </section>
      <section class="editor__panel">
        <h3>Cards</h3>
        <ul class="card-list" id="card-list"></ul>
      </section>
    </div>
    <p class="editor__status" id="status"></p>
  `
  host.appendChild(root)

  const adList = root.querySelector<HTMLUListElement>('#ad-list')!
  const cardList = root.querySelector<HTMLUListElement>('#card-list')!
  const status = root.querySelector<HTMLParagraphElement>('#status')!

  function renderAds(): void {
    const itens = [...draft.publicidade.itens].sort((a, b) => a.ordem - b.ordem)
    adList.innerHTML = ''
    itens.forEach((item) => {
      const li = document.createElement('li')
      li.className = 'ad-item'
      li.draggable = true
      li.dataset.id = item.id
      li.innerHTML = `
        <span class="ad-item__grip">⠿</span>
        <span class="ad-item__thumb">${item.tipo === 'video' ? '🎬' : '🖼️'}</span>
        <span class="ad-item__name">${escapeHtml(fileName(item.arquivo))}</span>
        <label class="ad-item__toggle">
          <input type="checkbox" ${item.ativo ? 'checked' : ''} /> ativo
        </label>`
      li.querySelector('input')!.addEventListener('change', (e) => {
        item.ativo = (e.target as HTMLInputElement).checked
        markDirty()
      })
      addDnd(li)
      adList.appendChild(li)
    })
  }

  let dragId: string | null = null
  function addDnd(li: HTMLLIElement): void {
    li.addEventListener('dragstart', () => {
      dragId = li.dataset.id ?? null
      li.classList.add('dragging')
    })
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging')
      dragId = null
    })
    li.addEventListener('dragover', (e) => {
      e.preventDefault()
      const after = shouldInsertAfter(li, e.clientY)
      const dragging = adList.querySelector('.dragging')
      if (!dragging || dragging === li) return
      if (after) li.after(dragging)
      else li.before(dragging)
    })
    li.addEventListener('drop', () => {
      commitOrderFromDom()
    })
  }

  function shouldInsertAfter(li: HTMLElement, y: number): boolean {
    const r = li.getBoundingClientRect()
    return y > r.top + r.height / 2
  }

  function commitOrderFromDom(): void {
    const ids = [...adList.querySelectorAll<HTMLLIElement>('.ad-item')].map((li) => li.dataset.id)
    ids.forEach((id, i) => {
      const it = draft.publicidade.itens.find((x) => x.id === id)
      if (it) it.ordem = i
    })
    void dragId
    markDirty()
    renderAds()
  }

  function renderCards(): void {
    cardList.innerHTML = ''
    draft.layout.cards.forEach((card) => {
      const li = document.createElement('li')
      li.className = 'card-row'
      const abertura = card.abertura ?? 'modal'
      li.innerHTML = `
        <input class="card-row__title" value="${escapeHtml(t(card.titulo, locale()))}" />
        <span class="card-row__act">${card.acao.tipo}</span>
        <select class="card-row__open" title="Como abre ao tocar">
          <option value="modal" ${abertura === 'modal' ? 'selected' : ''}>Modal</option>
          <option value="pagina" ${abertura === 'pagina' ? 'selected' : ''}>Página</option>
        </select>
        <label class="ad-item__toggle"><input type="checkbox" ${card.ativo ? 'checked' : ''}/> ativo</label>`
      const titleInput = li.querySelector<HTMLInputElement>('.card-row__title')!
      titleInput.addEventListener('input', () => {
        if (typeof card.titulo === 'string') card.titulo = titleInput.value
        else card.titulo[locale()] = titleInput.value
        markDirty()
      })
      li.querySelector<HTMLSelectElement>('.card-row__open')!.addEventListener('change', (e) => {
        card.abertura = (e.target as HTMLSelectElement).value as typeof card.abertura
        markDirty()
      })
      li.querySelector('input[type=checkbox]')!.addEventListener('change', (e) => {
        card.ativo = (e.target as HTMLInputElement).checked
        markDirty()
      })
      cardList.appendChild(li)
    })
  }

  let dirty = false
  function markDirty(): void {
    dirty = true
    status.textContent = 'Alterações não salvas.'
  }

  root.querySelector('[data-act=save]')!.addEventListener('click', async () => {
    try {
      await saveConfig(draft)
      dirty = false
      status.textContent = 'Salvo.'
    } catch (err) {
      status.textContent = 'Erro ao salvar: ' + (err as Error).message
    }
  })

  root.querySelector('[data-act=exit]')!.addEventListener('click', () => {
    if (dirty && !confirm('Sair sem salvar? As alterações serão perdidas.')) return
    onExit(draft)
  })

  const presetSelect = root.querySelector<HTMLSelectElement>('#preset-select')!
  presetSelect.addEventListener('change', () => {
    const preset = PRESETS.find((p) => p.id === presetSelect.value)
    presetSelect.value = ''
    if (!preset) return
    if (!confirm(`Aplicar o modelo "${preset.nome}"? Isso substitui a configuração atual (você ainda pode editar e só grava ao Salvar).`)) return
    draft = structuredClone(preset.config)
    markDirty()
    renderAds()
    renderCards()
  })

  renderAds()
  renderCards()

  return {
    destroy() {
      host.innerHTML = ''
    }
  }
}

function fileName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  )
}
