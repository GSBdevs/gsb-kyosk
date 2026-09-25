# SB Kyosk

Totem de autoatendimento **editável e offline**, genérico (igreja, clínica, qualquer
estabelecimento). Runtime + editor no mesmo app Electron. Config-driven via
`config/totem.config.json`; mídia local em `midia/publicidade/`.

Inspirado na análise da referência *Click Igreja* — ver [`docs/ANALISE-CLICKIGREJA.md`](docs/ANALISE-CLICKIGREJA.md)
e as decisões em [`docs/DECISOES-v1.md`](docs/DECISOES-v1.md).

## Layout

Totem retrato em coluna: header (logo + idiomas) · grade N×M de cards · faixa de
publicidade 16:9 fixa no rodapé (imagens e vídeos, offline).

## Scripts

```bash
npm install
npm run dev        # app Electron (kiosk em prod, janela em dev)
npm run dev:web    # só o renderer no navegador (http://localhost:5174) — p/ verificação
npm run typecheck  # checagem de tipos (main + renderer)
npm run compile    # apenas compila os bundles (out/), sem empacotar
npm run build      # compila E gera o .exe do Windows (release/) via electron-builder
```

### Gerar o .exe (Windows)

`npm run build` produz em `release/`:
- `SB Kyosk Setup <versão>.exe` — instalador (NSIS)
- `SB Kyosk <versão>.exe` — portátil
- `win-unpacked/SB Kyosk.exe` — app descompactado

`config/`, `midia/` e `assets/` são copiados **ao lado do .exe** (editáveis sem reinstalar).

> **Nota (1ª vez):** o electron-builder baixa o `winCodeSign`, cujo pacote traz symlinks de
> macOS. No Windows sem *Modo de Desenvolvedor*/admin, a extração falha. Solução aplicada:
> ative o **Modo de Desenvolvedor** do Windows, **ou** pré-extraia o cache ignorando `darwin`
> (feito neste ambiente). O build é sem assinatura (unsigned) — normal para uso interno.

No modo `dev:web` a bridge `window.kyosk` não existe; o app lê `public/totem.config.json`
e o "Salvar" do editor baixa um arquivo em vez de gravar no disco.

## Estrutura

```
config/totem.config.json   # fonte da verdade (editável)
midia/publicidade/         # arquivos da faixa (01_..., 02_...) — pasta-solta
public/                    # cópias servidas ao dev server web (seed + placeholders)
src/main/                  # processo Electron: janela kiosk, IO de config, watcher, protocolo kyosk://
src/preload/               # bridge segura window.kyosk
src/renderer/src/
  ├─ types.ts              # contrato de dados genérico
  ├─ config-source.ts      # acesso a dados (bridge Electron ou fetch web) + merge da pasta
  ├─ totem/                # runtime: header, cards, ads (carrossel 16:9)
  └─ editor/               # editor (drag-drop de mídia, edição de cards)
```

## Estado

v1 — verificado no navegador e empacotado:
- Runtime config-driven: grade **adaptável** (não corta/estica), carrossel 16:9 de altura
  configurável (`publicidade.alturaVh`), overlay de card redesenhado (modal estiloso).
- Tema moldável por config (cores, acento, raio) → visual por-destino **sem código**.
- Editor (protegido por PIN opcional, `editorPin`): reordenar/ativar mídia (drag-drop),
  editar cards, e **aplicar modelos** (presets igreja/clínica).
- Sync opcional (`config/sync.json`, desativado por padrão): puxa config remota; download de
  mídia é o próximo incremento.
- Build Windows `.exe` funcionando (`npm run build`).

Próximos (por customização): QR Pix real, telas `pdf`/`galeria`, download de mídia no sync,
editor de tema/telas, fluxo definitivo do PIN.
