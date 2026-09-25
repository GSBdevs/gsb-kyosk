import './styles.css'
import { loadConfig, bridge, isPanel, panelStatus, authenticate } from './config-source'
import { mountRuntime, type RuntimeHandle } from './totem/runtime'
import { mountEditor, type EditorHandle } from './editor/editor'
import type { TotemConfig } from './types'

const app = document.getElementById('app')!
let config: TotemConfig
let runtime: RuntimeHandle | null = null
let editor: EditorHandle | null = null

async function showRuntime(): Promise<void> {
  editor?.destroy()
  editor = null
  runtime = await mountRuntime(app, config)
  ensureToggle()
}

function showEditor(): void {
  runtime?.destroy()
  runtime = null
  removeToggle()
  editor = mountEditor(app, config, (updated) => {
    config = updated
    void showRuntime()
  })
}

// Botão discreto para abrir o editor embutido (protegido por PIN quando configurado).
let toggleBtn: HTMLButtonElement | null = null
function ensureToggle(): void {
  if (toggleBtn) return
  toggleBtn = document.createElement('button')
  toggleBtn.className = 'mode-toggle'
  toggleBtn.title = 'Editor'
  toggleBtn.textContent = '⚙'
  toggleBtn.addEventListener('click', openEditorGated)
  document.body.appendChild(toggleBtn)
}
function removeToggle(): void {
  toggleBtn?.remove()
  toggleBtn = null
}

async function openEditorGated(): Promise<void> {
  const pin = config.editorPin?.trim()
  if (!pin) return showEditor()
  const ok = await promptPin((v) => v === pin)
  if (ok) showEditor()
}

/** Modal de PIN genérico. `validate` decide se o PIN é válido (local ou via servidor). */
function promptPin(validate: (pin: string) => boolean | Promise<boolean>): Promise<boolean> {
  return new Promise((resolve) => {
    const ov = document.createElement('div')
    ov.className = 'overlay'
    ov.innerHTML = `<div class="sheet" style="width:min(360px,92vw)">
      <div class="sheet__head"><h2 class="sheet__title">PIN de acesso</h2>
        <button class="sheet__close" aria-label="Fechar">✕</button></div>
      <div class="sheet__content">
        <input class="pin-input" type="password" inputmode="numeric" autocomplete="off"
          style="width:100%;font-size:22px;letter-spacing:6px;text-align:center;padding:12px;
          border-radius:10px;border:1px solid rgba(255,255,255,.15);background:#0e1b2e;color:#fff" />
        <p class="pin-msg" style="min-height:18px;color:#ff9b9b;margin:10px 0 0"></p>
      </div>
    </div>`
    const done = (v: boolean): void => {
      ov.remove()
      resolve(v)
    }
    ov.querySelector('.sheet__close')!.addEventListener('click', () => done(false))
    ov.addEventListener('click', (e) => {
      if (e.target === ov) done(false)
    })
    const input = ov.querySelector<HTMLInputElement>('.pin-input')!
    const msg = ov.querySelector<HTMLParagraphElement>('.pin-msg')!
    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        if (await validate(input.value)) done(true)
        else {
          msg.textContent = 'PIN incorreto.'
          input.value = ''
        }
      } else if (e.key === 'Escape') done(false)
    })
    document.body.appendChild(ov)
    input.focus()
  })
}

/** Boot do painel externo (LAN): autentica se preciso e abre direto o editor. */
async function bootPanel(): Promise<void> {
  const st = await panelStatus()
  if (st?.needsPin) {
    // exige PIN até acertar (validação no servidor)
    // eslint-disable-next-line no-constant-condition
    for (;;) {
      const ok = await promptPin((v) => authenticate(v))
      if (ok) break
    }
  }
  config = await loadConfig()
  const openEditor = (): void => {
    editor = mountEditor(app, config, (updated) => {
      config = updated
      openEditor() // no painel não há totem para voltar; reabre o editor
    })
  }
  openEditor()
}

async function bootTotem(): Promise<void> {
  config = await loadConfig()
  await showRuntime()

  // Recarrega quando a config ou a mídia mudam no disco (Electron).
  const b = bridge()
  if (b) {
    b.onConfigChanged(async () => {
      config = await loadConfig()
      if (!editor) await showRuntime()
    })
    b.onMediaChanged(() => {
      if (!editor) void showRuntime()
    })
  }
}

const boot = isPanel() ? bootPanel : bootTotem
boot().catch((err) => {
  app.innerHTML = `<pre style="padding:24px;color:#f88">Erro ao iniciar: ${String(err)}</pre>`
})
