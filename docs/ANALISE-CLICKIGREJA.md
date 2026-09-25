# Análise — Click Igreja (referência) → sb-kyosk

> Análise técnica do sistema em `oficialclickigreja.vercel.app` (totem de autoatendimento
> para paróquias) como base para o projeto **sb-kyosk**.
> Data: 2026-09-24.

---

## 1. O que é o sistema de referência

App de **autoatendimento para igreja** rodando em **totem vertical** (formato retrato). A
paróquia analisada: *Paróquia e Santuário Nossa Senhora de Fátima* (Fortaleza-CE).

URL analisada:
`/catolica/pt-BR/paroquia-e-santuario-nossa-senhora-de-fatima`
→ padrão de rota: `/{segmento}/{locale}/{slug-da-igreja}`

### Layout (totem retrato, coluna flex)

```
┌─────────────────────────┐
│      LOGO + idiomas      │  header (BR / US / ES via flagcdn.com)
├─────────────────────────┤
│   ┌─────┐ ┌─────┐ ┌────┐ │
│   │Missa│ │Inten│ │Dízi│ │  grade 3×2 de CARDS (área flex-1)
│   └─────┘ └─────┘ └────┘ │  fundo = imagem "escadaria para o céu"
│   ┌─────┐ ┌─────┐ ┌────┐ │
│   │Ofert│ │Secre│ │Outr│ │
│   └─────┘ └─────┘ └────┘ │
├─────────────────────────┤
│   ███ PUBLICIDADE ███    │  faixa 16:9 fixa embaixo (carrossel)
└─────────────────────────┘
```

6 cards fixos: **Missas e Confissões · Intenções de Missas · Dízimo · Ofertas · Secretaria ·
Outras Informações**.

### A faixa de publicidade (o ponto que você citou)

Medição no DOM:

| Propriedade | Valor |
|---|---|
| Container | `div.relative.z-[25].w-full.shrink-0.overflow-hidden.aspect-video` |
| Proporção | **16:9 (`aspect-video`)**, largura total |
| Ajuste da mídia | `object-contain` sobre **fundo preto** (`bg-black`) |
| Posição | fixada no rodapé da coluna (`shrink-0`, não encolhe) |
| Nº de anúncios | 8 imagens rotacionando |
| Resolução real dos anúncios | ~1672×941 (≈16:9) |

Ou seja: "só cabe nessa parte de baixo" = é um **bloco 16:9 pinado no rodapé**. A mídia é
encaixada com `object-contain` (não corta, deixa tarja preta se a proporção não bater). Esse é
exatamente o comportamento a replicar — e a decidir se mantemos `contain` (sem corte, com tarja)
ou `cover` (preenche, cortando bordas).

---

## 2. Stack técnica (deduzida)

| Camada | Tecnologia |
|---|---|
| Frontend | **Next.js (App Router, Turbopack)** |
| Hospedagem | **Vercel** |
| Backend/Dados | **Supabase** (Postgres + Storage) |
| Storage de mídia | Supabase Storage — buckets `totem-assets` e `totem-advertisements` |
| Multi-tenant | por `client_id` (UUID), totem resolvido por `slug` |
| i18n | pt-BR / en / es (bandeiras via `flagcdn.com`) |
| Imagens | `next/image` (otimização server-side, `w=…&q=75`) |
| Fundo animado | `/videos/motion.mp4` (vídeo de fundo, servido por range `206`) |

**API pública (única chamada de dados):**
`GET /api/public/totem/slug/{slug}?t={timestamp}` → devolve todo o estado do totem em um JSON.

### Modelo de dados (extraído do JSON real)

```jsonc
{
  "totemInfo": {
    "id", "client_id",
    "masses_church_name", "masses_church_address",
    "secretary_title", "secretary_description",
    "secretary_schedule_weekdays", "secretary_schedule_weekend",
    "secretary_phone", "secretary_email",
    "other_info_title", "other_info_description", "other_info_services",
    "other_info_liturgy_url", "other_info_website_url",
    "other_info_social_media_url", "other_info_contact_url",
    "home_logo_url",              // logo no Supabase Storage
    "home_background_image_url",  // fundo custom (null = usa padrão)
    "home_background_color",      // cor de fundo alternativa
    "home_button_color",          // cor dos cards
    "other_info_buttons": [       // ← botões dinâmicos (JSON string)
      { "id": "btn-…", "title": "Site Oficial",      "url": "https://…" },
      { "id": "btn-…", "title": "Instagram Oficial",  "url": "https://…" },
      { "id": "btn-…", "title": "Canal YouTube",      "url": "https://…" },
      { "id": "btn-…", "title": "TikTok Oficial",     "url": "https://…" }
    ]
  },

  "schedules": [                  // horários de missa/confissão
    { "id", "client_id", "day": "sunday", "time": "07:00",
      "type": "mass" | "confession", "description",
      "specific_date", "day_range": "tuesday-friday" }
  ],

  "advertisements": [             // ← a faixa de publicidade
    { "id", "client_id",
      "type": "image" | "video",  // suporta vídeo também
      "url": "https://…supabase…/totem-advertisements/…",
      "title", "description",
      "order_index": 0,           // ← controla a ORDEM
      "is_active": true }         // ← liga/desliga sem apagar
  ],

  "financialConfig": null         // config de Dízimo/Ofertas (Pix/pagamento)
}
```

**Observações-chave:**

- **Conteúdo já é editável via banco** — nomes, horários, contatos, botões de "Outras
  Informações", anúncios. Existe (implícito) um painel admin que grava nessas tabelas.
- **`advertisements` já suporta `type: "video"`**, ordenação (`order_index`) e ativar/desativar
  (`is_active`). É o modelo certo para o carrossel do rodapé.
- **Os 6 cards principais são FIXOS/hardcoded** no frontend — mapeiam para seções fixas
  (missas, intenções, dízimo, ofertas, secretaria, outras infos). **Não** dá para reordenar,
  renomear ou remapear o destino de cada card. Só os 4 botões de "Outras Informações" são
  dinâmicos (título + URL).
- **Tudo é online.** Depende de Vercel + Supabase. Se cair a internet, o totem não carrega
  (não há cache local de dados nem de mídia).

---

## 3. Gap entre a referência e o SEU objetivo

Seu objetivo declarado para o sb-kyosk:

> "completamente editável — tanto **posição** quanto **conteúdo**, quanto **para onde cada card
> vai**" + "manter vídeos e imagens rodando **offline** e de forma **intuitiva para trocar**".

| Requisito seu | Referência (Click Igreja) | Gap |
|---|---|---|
| Editar **conteúdo** dos cards | ✅ (via banco) | — |
| Editar **posição/ordem** dos cards | ❌ cards fixos | **precisa construir** |
| Editar **destino** de cada card (link/tela) | ⚠️ só nos 4 botões extras | **precisa generalizar p/ todos** |
| Publicidade rodapé 16:9 | ✅ imagem+vídeo, ordenável | replicar |
| Rodar **offline** (mídia + dados) | ❌ 100% online | **precisa construir** |
| Troca **intuitiva** de mídia | ⚠️ presumível painel web | melhorar (drag-drop / pasta) |

Resumo: a referência resolve **conteúdo dinâmico multi-tenant online**. Ela **não** resolve os
seus dois diferenciais centrais — **layout editável (posição + destino livre de cada card)** e
**operação offline**. É aí que o sb-kyosk se diferencia.

---

## 4. Sistemas e repositórios semelhantes (pesquisa)

### 4a. Digital signage open-source com playback OFFLINE (para o rodapé/mídia)

- **Anthias** (ex-Screenly OSE) — o signage OSS mais implantado; Raspberry Pi/x86; playback local.
- **Xibo** — o mais completo para multi-tela; agendamento e playlists robustos.
- **OpenFrame** — *local-first*: o player baixa o conteúdo e **continua tocando a última playlist
  quando a conexão cai**. Servidor em Docker. (Exatamente o padrão sync-then-play que queremos.)
- **ScreenTinker** — CMS de signage com "offline-native playback".
- **PiSignage / Obscreen / Anthias** — variações para Pi.

Padrão a copiar deles: **"sincroniza quando tem rede, toca do disco local sempre"**.

### 4b. Kiosk editável / config local (para o layout + offline)

- **UniKiosk** — editor **drag-and-drop em grade**; layout guardado em **células de grade, não
  pixels** → um design feito para tela larga sobrevive ao ser posto num totem retrato. É o modelo
  conceitual certo para "posição editável".
- **ericksuzano/totem-game** — configs editáveis em `resources/app-config.json` **ao lado do
  .exe**, sem gerar novo instalador; **funciona offline**. (Padrão que você já conhece dos seus
  totens.)
- **wit-project-sku/kiosk-electron** — "**SQLite é a fonte da verdade; nada depende da rede**".
- **syedhassaanahmed/kiosk-demo-electron** — empacotar Electron em modo kiosk no Windows.

### 4c. Giving / dízimo (para Dízimo e Ofertas)

Tithely, Donorbox, easyTithe, Continue To Give, ParishSOFT — kiosks de doação com cartão/Pix.
**Nota:** processar pagamento/cartão no totem é área sensível (PCI). Recomendação: para dízimo/
ofertas, **exibir QR Code Pix** (copia-e-cola / QR estático da paróquia) em vez de capturar
cartão no dispositivo. Zero PCI, 100% offline-friendly.

---

## 5. Direção de arquitetura recomendada para o sb-kyosk

O ponto central: você quer **editável + offline**. Isso empurra para um modelo **local-first**,
não um SaaS-only como a referência.

### Modelo de dados local (um único JSON/SQLite versionável)

```jsonc
// totem.config.json — fonte da verdade, fica ao lado do app
{
  "igreja": { "nome", "endereco", "logo": "assets/logo.png", "corBotao", "fundo" },
  "layout": {
    "grid": { "cols": 3, "rows": 2 },        // grade configurável
    "cards": [
      { "id","titulo","icone","pos": { "col":1,"row":1 },
        "acao": { "tipo":"tela"|"url"|"pix"|"pdf", "destino":"…" } }
      // posição E destino de cada card = livres
    ]
  },
  "publicidade": {
    "proporcao": "16:9",
    "ajuste": "contain" | "cover",
    "intervaloSegundos": 8,
    "itens": [
      { "id","tipo":"image"|"video","arquivo":"midia/terco.mp4",
        "ordem":0,"ativo":true }
    ]
  },
  "horarios": [ /* missas/confissões */ ]
}
```

- **Posição livre** → `layout.grid` + `cards[].pos`.
- **Destino livre por card** → `cards[].acao` (abre tela interna, URL, QR Pix, PDF…).
- **Mídia offline** → `publicidade.itens[].arquivo` aponta para **arquivo local** (pasta `midia/`),
  não URL remota.

### Como manter mídia offline e troca intuitiva

Três níveis, do mais simples ao mais robusto:

1. **Pasta-solta (mais intuitivo p/ leigo):** o app varre uma pasta `midia/publicidade/`. Basta
   **arrastar/colar arquivos** na pasta → aparecem no rodapé, em ordem alfabética/numérica
   (`01_…`, `02_…`). Sem editor, sem técnico. (Padrão "Adeus Pendrive" que você já mapeou.)
2. **Editor visual (drag-drop):** tela de admin no próprio totem (ou app à parte) que lista a
   mídia, permite reordenar arrastando, ligar/desligar, e importar arquivos — grava no
   `totem.config.json`. Melhor UX, mais trabalho.
3. **Sync opcional (híbrido):** se um dia quiser gerenciar remoto, um sync baixa a mídia para o
   disco e **continua tocando local** (padrão OpenFrame). Offline continua sendo o default.

### Casca de execução

Coerente com seus outros totens (memória: Totem Launcher, bingo, perguntas, sorteador):
**Electron (Windows/totem) + Vite/TS**, modo kiosk fullscreen, mídia e config no disco, opção de
empacotar `.exe` com `config.json` externo editável (padrão `ericksuzano/totem-game`).

### Resolução / vídeo offline — cuidados

- Faixa 16:9 com `object-contain` (sem corte) **ou** `object-cover` (preenche, corta) — decisão
  de arte. Recomendo tornar isso um campo (`ajuste`) por-totem.
- Vídeo: **H.264/MP4**, `muted` + `autoplay` + `loop` (autoplay só funciona mudo), pré-carregar o
  próximo item para transição sem "piscar".
- Padronizar a mídia para a proporção-alvo evita tarja preta; um passo de "normalizar" com FFmpeg
  (você já usou no SB Signage) resolve lotes de arquivos fora de proporção.

---

## 6. Decisões em aberto (precisam da sua definição antes do código)

1. **Escopo de edição de layout:** grade fixa 3×2 configurável só em conteúdo, ou **grade e
   posições totalmente livres** (drag-drop)? (Muda muito o esforço.)
2. **Offline puro vs. híbrido:** 100% local (pasta/JSON) ou local-first **com** sync remoto
   opcional?
3. **Casca:** Electron/Windows (como seus outros totens) ou PWA/web também?
4. **Dízimo/Ofertas:** QR Pix estático (recomendado, sem PCI) ou integração de pagamento real?
5. **Multi-igreja:** um totem = uma igreja (config única), ou precisa multi-tenant como a
   referência?
6. **Troca de mídia:** pasta-solta (nível 1) já basta, ou quer o editor drag-drop (nível 2) desde
   a v1?

---

## 7. Fontes

- OpenFrame — https://github.com/veRoduS/OpenFrame
- Anthias — https://anthias.screenly.io/
- ScreenTinker — https://screentinker.com/
- PiSignage — https://www.pisignage.com/
- UniKiosk (features) — https://unikiosk.io/features
- ericksuzano/totem-game — https://github.com/ericksuzano/totem-game
- wit-project-sku/kiosk-electron — https://github.com/wit-project-sku/kiosk-electron
- syedhassaanahmed/kiosk-demo-electron — https://github.com/syedhassaanahmed/kiosk-demo-electron
- Tithely — https://get.tithe.ly/ · easyTithe — https://www.easytithe.com/
