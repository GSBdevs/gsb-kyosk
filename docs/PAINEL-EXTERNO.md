# SB Kyosk — Painel externo local (LAN)

Especificação do painel de administração **externo**, além do editor embutido no totem.
Decisão (2026-09-25): **painel local na rede, offline** — sem nuvem, sem hospedagem.
Cada totem hospeda o próprio painel; o admin edita de outro aparelho na mesma rede.

## 1. Conceito

O app do totem (Electron) sobe, além da janela kiosk, um **servidor HTTP local** numa porta
(ex.: `8787`) ligado à LAN. O administrador abre `http://<ip-do-totem>:8787` do celular/PC na
**mesma rede**, autentica com PIN/token e edita conteúdo, publicidade e tema. As alterações
gravam nos mesmos arquivos do disco (`config/`, `midia/`) e o totem **recarrega ao vivo** pelos
watchers que já existem.

```
   [Celular/PC do admin]  --- Wi-Fi/LAN --->  [Totem: Electron]
        navegador                               ├─ janela kiosk (público)
        http://192.168.x.x:8787                 └─ servidor HTTP local (admin)
                                                     ├─ serve a UI do painel
                                                     └─ REST /api/* → lê/grava config e mídia no disco
                                                            │
                                                     watcher → recarrega o totem ao vivo
```

Sem internet envolvida. Se não houver rede, o **editor embutido** no totem continua funcionando.

## 2. Por que assim (coerência com o projeto)

- Mantém o **local-first / offline** já decidido.
- **Reaproveita** o editor que já existe: a mesma UI passa a rodar em dois transportes
  (IPC dentro do totem, HTTP na rede).
- **Reaproveita** os watchers já implementados → recarga ao vivo de graça.
- Multi-totem central (nuvem) fica como caminho **futuro** (é a outra opção, com Supabase),
  sem impedir este.

## 3. Arquitetura

### 3.1 Camada de dados única (refactor)
Hoje a leitura/escrita de config e a listagem de mídia vivem no `main` e são expostas por IPC.
Extrair para um módulo compartilhado `src/main/store.ts`:

```
readConfig() / writeConfig(cfg)
listMediaFiles() / saveMediaFile(nome, bytes) / deleteMediaFile(nome)
```

Esse módulo passa a ser a **fonte única**, usado por:
- os handlers **IPC** (editor embutido), e
- as rotas **HTTP** (painel externo).

### 3.2 Servidor HTTP embutido (no main)
- Sobe em `app.whenReady()` se `config/panel.json.enabled = true`.
- Liga em `0.0.0.0:<port>` (LAN). Porta e habilitação configuráveis.
- Serve:
  - a **UI do painel** (bundle estático), e
  - a **API REST** abaixo.
- Stack: `http` nativo do Node + um roteador mínimo (zero dependências) **ou** `fastify`
  (mais limpo, +1 dep). Recomendação: começar com o `http` nativo para não pesar o pacote.

### 3.3 API REST
```
POST   /api/auth        { pin }            → { token }         (valida PIN/token)
GET    /api/config                          → TotemConfig
PUT    /api/config      TotemConfig         → { ok }
GET    /api/media                           → [ { nome, tipo, url } ]
POST   /api/media       (multipart upload)  → { ok, nome }
DELETE /api/media/:nome                      → { ok }
GET    /api/status                          → { versao, ultimaEdicao, online }
```
Toda rota (exceto `/api/auth`) exige o token no header `Authorization`.

### 3.4 UI do painel = editor reaproveitado
- Fatorar o editor atual para funcionar sob **dois transportes** via a abstração `config-source`:
  - **Electron (embutido):** usa `window.kyosk` (IPC) — já existe.
  - **Navegador na LAN (painel):** usa `fetch` para `/api/*`.
  - **Modo web de verificação:** `fetch` de arquivos estáticos — já existe.
- O painel externo é um **superset** do editor embutido (mesma base + mais telas).

### 3.5 Descoberta (facilitar o acesso)
- No editor embutido do totem, mostrar **"Painel: http://192.168.x.x:8787"** + um **QR Code**
  para o admin abrir no celular sem digitar IP.

## 4. Telas do painel
1. **Login** (PIN/token).
2. **Visão geral** — status do totem, última edição, versão, itens ativos.
3. **Conteúdo** — cards (posição, título, ícone, destino/ação) e telas internas.
4. **Publicidade** — upload, reordenar (drag-drop), ativar/desativar, duração, contain/cover, altura.
5. **Tema** — cores, raio, logo, fundo.
6. **Modelos** — aplicar presets (igreja/clínica/…).
7. *(futuro)* Sincronização / registro do totem.

## 5. Segurança (rede local)
- **Token obrigatório** em todas as rotas de dados; sessão expira.
- Painel **desligado por padrão** (`panel.json.enabled=false`); liga-se conscientemente.
- Ligar à LAN dispara o **aviso de firewall do Windows** na 1ª vez (documentar; liberar a porta).
- Escopo é a rede local — quem está na LAN alcança o painel; por isso o token e o liga/desliga.
- Sem dados sensíveis/pagamento no painel (conteúdo de totem).

## 6. Configuração nova (`config/panel.json`)
```json
{ "enabled": false, "port": 8787, "token": "" }
```
(`token` vazio → cai no `editorPin` da config como credencial.)

## 7. Fases de implementação
- **Fase 1 — base:** ✅ FEITA e verificada (2026-09-25). `store.ts` (fonte única); servidor HTTP
  (`panel-server.ts`, http nativo) com `/api/status`, `/api/config` GET/PUT, `/api/media` GET,
  `/api/auth` (PIN); serve o bundle do editor com flag de painel; `/files/*` serve config/mídia;
  recarga ao vivo pelos watchers. **Detalhe:** o flag do painel é injetado via `/__panel.js`
  (arquivo de mesma origem) porque o CSP `script-src 'self'` bloqueia script inline.
  Config em `config/panel.json` (desligado por padrão).
- **Fase 2 — mídia:** `/api/media` (listar/upload/excluir) + UI de upload no painel.
- **Fase 3 — completar UI:** tema e telas; QR/descoberta no totem.
- **Fase 4 — polimento:** expiração de sessão, logs, liga/desliga pelo editor embutido.

## 8. Riscos / decisões em aberto
- **Dependência do servidor:** `http` nativo (zero deps) vs `fastify` (+1 dep, mais limpo). → definir.
- **Upload:** multipart (via `busboy`) vs base64 em JSON (mais simples, arquivos menores). → definir.
- **Porta/firewall** no Windows: documentar liberação; talvez configurar no instalador.
- **Multi-totem central** (nuvem) continua sendo o outro caminho, não coberto aqui.
