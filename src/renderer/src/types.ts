// Contrato de dados do totem — genérico (serve igreja, clínica, qualquer estabelecimento).
// É a "fonte da verdade" editável, persistida em config/totem.config.json.

export type Locale = string // ex.: "pt-BR", "en", "es"

/** Texto que pode ser localizado. String simples = mesmo texto em todos os idiomas. */
export type Localized = string | Record<Locale, string>

export type CardActionType =
  | 'tela' // abre uma tela de conteúdo interna (ver Config.telas)
  | 'url' // abre um link (navegador embutido/externo)
  | 'pix' // exibe QR Code Pix estático
  | 'pdf' // abre um PDF local
  | 'galeria' // abre uma galeria de imagens

export interface CardAction {
  tipo: CardActionType
  /** id da tela, URL, chave Pix, caminho do PDF, etc. conforme `tipo`. */
  destino: string
}

/** Como o conteúdo do card se abre. */
export type CardOpenMode =
  | 'modal' // janela central sobreposta (padrão)
  | 'pagina' // tela inteira, cobre o totem (com botão voltar)

export interface Card {
  id: string
  titulo: Localized
  /** nome de ícone ou caminho para uma imagem/SVG. */
  icone?: string
  /** cor de fundo do card (sobrescreve o tema). */
  cor?: string
  /** posição na grade (1-based). Usada apenas no modo de layout "manual". */
  pos?: { col: number; row: number }
  acao: CardAction
  /** como o conteúdo abre ao tocar (padrão "modal"). */
  abertura?: CardOpenMode
  ativo: boolean
}

export interface GridConfig {
  /** "auto" (padrão): a grade se adapta à QUANTIDADE de cards.
   *  "manual": usa cols/rows fixos e a posição de cada card. */
  modo?: 'auto' | 'manual'
  /** usados no modo "manual" (e como teto no "auto"). */
  cols: number
  rows: number
  /** espaçamento entre cards, em px. */
  gap?: number
}

export interface Tema {
  corPrimaria?: string
  corCard?: string
  corTextoCard?: string
  corFundo?: string
  /** cor de destaque (usada em overlays/telas). */
  corAcento?: string
  /** raio das bordas dos cards/telas, ex.: "18px". */
  raio?: string
  /** imagem de fundo (caminho local ou URL). */
  fundoImagem?: string
  /** vídeo de fundo (caminho local ou URL). */
  fundoVideo?: string
}

export interface Estabelecimento {
  nome: Localized
  /** caminho/URL do logo. */
  logo?: string
  tema: Tema
  /** idiomas oferecidos; o primeiro é o padrão. */
  idiomas: Locale[]
}

/** Tela de conteúdo interna, aberta por um card com acao.tipo === "tela". */
export interface Tela {
  id: string
  titulo: Localized
  tipo: 'texto' | 'lista' | 'horarios' | 'contato' | 'custom'
  /** conteúdo livre conforme o tipo (renderizado pela tela correspondente). */
  conteudo: unknown
}

export type MediaFit = 'contain' | 'cover'

export interface AdItem {
  id: string
  tipo: 'image' | 'video'
  /** caminho local (midia/publicidade/...) ou URL. */
  arquivo: string
  ordem: number
  ativo: boolean
  /** duração em segundos para imagens (vídeo usa a própria duração). */
  duracaoSegundos?: number
}

export interface Publicidade {
  /** proporção de referência da mídia, ex.: "16:9". */
  proporcao: string
  ajuste: MediaFit
  /** altura da faixa como % da altura da tela (ex.: 26 = 26vh). Menor = mais espaço p/ cards. */
  alturaVh?: number
  /** duração padrão de cada imagem, em segundos. */
  intervaloSegundos: number
  itens: AdItem[]
}

export interface TotemConfig {
  /** versão do schema, para migrações futuras. */
  schemaVersion: number
  /** PIN para abrir o editor no totem (vazio/ausente = sem proteção). Provisório. */
  editorPin?: string
  estabelecimento: Estabelecimento
  layout: { orientacao: 'retrato' | 'paisagem'; grid: GridConfig; cards: Card[] }
  telas: Tela[]
  publicidade: Publicidade
}
