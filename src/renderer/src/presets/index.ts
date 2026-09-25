// Presets ("modelos") que moldam o totem para um destino sem tocar em código.
// Aplicados pelo editor (protegido por PIN) — não expostos ao cliente.
// Cada preset é uma TotemConfig completa e continua 100% editável depois de aplicado.

import type { TotemConfig } from '../types'

export interface Preset {
  id: string
  nome: string
  config: TotemConfig
}

const igreja: TotemConfig = {
  schemaVersion: 1,
  estabelecimento: {
    nome: 'Paróquia Exemplo',
    logo: './assets/logo-placeholder.svg',
    idiomas: ['pt-BR', 'en', 'es'],
    tema: {
      corPrimaria: '#1f4e8c',
      corCard: 'rgba(31, 78, 140, 0.72)',
      corTextoCard: '#ffffff',
      corFundo: '#0b1b33',
      corAcento: '#6fb0ff',
      raio: '18px',
      fundoImagem: './assets/fundo-placeholder.svg',
      fundoVideo: ''
    }
  },
  layout: {
    orientacao: 'retrato',
    grid: { cols: 3, rows: 2, gap: 20 },
    cards: [
      card('missas', 'Missas e Confissões', 'clock', 1, 1, { tipo: 'tela', destino: 'tela-missas' }),
      card('intencoes', 'Intenções de Missas', 'star', 2, 1, { tipo: 'tela', destino: 'tela-intencoes' }),
      card('dizimo', 'Dízimo', 'qr', 3, 1, { tipo: 'pix', destino: 'chave-pix-paroquia' }),
      card('ofertas', 'Ofertas', 'qr', 1, 2, { tipo: 'pix', destino: 'chave-pix-paroquia' }),
      card('secretaria', 'Secretaria', 'phone', 2, 2, { tipo: 'tela', destino: 'tela-secretaria' }),
      card('outras', 'Outras Informações', 'info', 3, 2, { tipo: 'tela', destino: 'tela-outras' })
    ]
  },
  telas: [
    tela('tela-missas', 'Missas e Confissões', 'horarios', { itens: [] }),
    tela('tela-intencoes', 'Intenções de Missas', 'texto', { texto: 'Fale com a secretaria para registrar intenções.' }),
    tela('tela-secretaria', 'Secretaria', 'contato', { telefone: '', email: '', endereco: '' }),
    tela('tela-outras', 'Outras Informações', 'lista', { itens: [] })
  ],
  publicidade: pub()
}

const clinica: TotemConfig = {
  schemaVersion: 1,
  estabelecimento: {
    nome: 'Clínica Exemplo',
    logo: './assets/logo-placeholder.svg',
    idiomas: ['pt-BR'],
    tema: {
      corPrimaria: '#0f766e',
      corCard: 'rgba(15, 118, 110, 0.72)',
      corTextoCard: '#ffffff',
      corFundo: '#062925',
      corAcento: '#5eead4',
      raio: '16px',
      fundoImagem: '',
      fundoVideo: ''
    }
  },
  layout: {
    orientacao: 'retrato',
    grid: { cols: 3, rows: 2, gap: 20 },
    cards: [
      card('agendar', 'Agendamentos', 'clock', 1, 1, { tipo: 'tela', destino: 'tela-agendar' }),
      card('especialidades', 'Especialidades', 'grid', 2, 1, { tipo: 'tela', destino: 'tela-especialidades' }),
      card('exames', 'Resultados de Exames', 'info', 3, 1, { tipo: 'url', destino: 'https://exemplo.com/exames' }),
      card('convenios', 'Convênios', 'star', 1, 2, { tipo: 'tela', destino: 'tela-convenios' }),
      card('contato', 'Contato', 'phone', 2, 2, { tipo: 'tela', destino: 'tela-contato' }),
      card('local', 'Localização', 'globe', 3, 2, { tipo: 'tela', destino: 'tela-local' })
    ]
  },
  telas: [
    tela('tela-agendar', 'Agendamentos', 'texto', { texto: 'Dirija-se à recepção para agendar.' }),
    tela('tela-especialidades', 'Especialidades', 'lista', { itens: [] }),
    tela('tela-convenios', 'Convênios', 'lista', { itens: [] }),
    tela('tela-contato', 'Contato', 'contato', { telefone: '', email: '', endereco: '' }),
    tela('tela-local', 'Localização', 'texto', { texto: 'Endereço e mapa aqui.' })
  ],
  publicidade: pub()
}

export const PRESETS: Preset[] = [
  { id: 'igreja', nome: 'Igreja / Paróquia', config: igreja },
  { id: 'clinica', nome: 'Clínica / Consultório', config: clinica }
]

// --- helpers ---
function card(
  id: string,
  titulo: string,
  icone: string,
  col: number,
  row: number,
  acao: TotemConfig['layout']['cards'][number]['acao']
): TotemConfig['layout']['cards'][number] {
  return { id: `card-${id}`, titulo, icone, pos: { col, row }, acao, ativo: true }
}

function tela(
  id: string,
  titulo: string,
  tipo: TotemConfig['telas'][number]['tipo'],
  conteudo: unknown
): TotemConfig['telas'][number] {
  return { id, titulo, tipo, conteudo }
}

function pub(): TotemConfig['publicidade'] {
  return {
    proporcao: '16:9',
    ajuste: 'contain',
    alturaVh: 24,
    intervaloSegundos: 8,
    itens: [
      { id: 'ad-1', tipo: 'image', arquivo: './midia/publicidade/01_exemplo.svg', ordem: 0, ativo: true },
      { id: 'ad-2', tipo: 'image', arquivo: './midia/publicidade/02_exemplo.svg', ordem: 1, ativo: true },
      { id: 'ad-3', tipo: 'image', arquivo: './midia/publicidade/03_exemplo.svg', ordem: 2, ativo: true }
    ]
  }
}
