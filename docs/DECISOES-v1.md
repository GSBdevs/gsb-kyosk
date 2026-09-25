# sb-kyosk — Decisões da v1

Definições tomadas em 2026-09-24, após a [análise da referência](ANALISE-CLICKIGREJA.md)
(Click Igreja). Estas decisões guiam o escopo da v1.

## Decisões

| Tema | Decisão | Consequência |
|---|---|---|
| **Edição de layout** | **Grade fixa, conteúdo livre** | Grade N×M configurável; edita-se título, ícone e **destino** de cada card. Sem drag-drop de cards na v1. |
| **Rede** | **Local-first + sync opcional** | Roda sempre do disco; pode sincronizar config/mídia de um servidor quando houver rede. Offline é o default. |
| **Casca** | **Electron / Windows (kiosk)** | `.exe` fullscreen, config e mídia no disco, coerente com os outros totens GSB. |
| **Troca de mídia** | **Pasta-solta + editor drag-drop** | Base: varre `midia/publicidade/` e toca em ordem. Por cima: editor para importar/reordenar/ligar-desligar/tempo. |

## Escopo v1 resultante

**Runtime do totem (o que aparece na tela):**
- Layout retrato em coluna: header (logo + idiomas) · grade de cards (área flex) · faixa de
  publicidade 16:9 no rodapé.
- Cards renderizados a partir de `totem.config.json` (grade + conteúdo + destino por card).
- Destino por card (`acao`): `tela` (seção interna), `url`, `pix` (QR estático), `pdf`.
- Faixa de publicidade: carrossel 16:9, `contain|cover` configurável, imagem **e** vídeo
  (MP4/H.264, `muted`+`autoplay`+`loop`), pré-carga do próximo item.
- Fonte da mídia: arquivos locais (`midia/publicidade/`), lidos por pasta-solta.

**Editor (troca intuitiva):**
- Pasta-solta: convenção de nome (`01_`, `02_`…) define ordem; app detecta arquivos novos.
- Editor drag-drop: importar, reordenar arrastando, ativar/desativar, definir tempo por item;
  grava no `totem.config.json`.

**Sync opcional (fase posterior da v1 ou v1.1):**
- Padrão "sincroniza quando tem rede, toca do disco sempre" (estilo OpenFrame). Desligável.

**Fora do escopo da v1:**
- Drag-drop de posição dos cards (fica para v2 se necessário).
- Captura de cartão/pagamento real (PCI). Dízimo/Ofertas = QR Pix estático.
- Multi-tenant remoto ao estilo da referência (um totem = uma config; sync cobre atualização).

## Stack proposta

- **Electron** + **Vite** + **TypeScript** (padrão dos totens GSB).
- Fonte da verdade: `totem.config.json` no disco (versionável); `midia/` ao lado.
- Sem servidor obrigatório; sync opcional via HTTP quando configurado.
- Empacotamento: `.exe` com `config.json`/`midia` externos e editáveis sem reinstalar.

## Estrutura de pastas proposta

```
sb-kyosk/
├── docs/                      # análise + decisões (este dir)
├── config/
│   └── totem.config.json      # fonte da verdade (exemplo/seed)
├── midia/
│   └── publicidade/           # arquivos locais da faixa (01_..., 02_...)
├── src/
│   ├── main/                  # processo Electron (janela kiosk, watcher de pasta, sync)
│   ├── preload/               # bridge segura
│   └── renderer/              # UI do totem (runtime) + editor
│       ├── totem/             # header, grade de cards, faixa 16:9
│       └── editor/            # editor de mídia drag-drop
└── package.json
```
