import type { Locale, Localized } from './types'

/** Resolve um texto localizado para o idioma atual, com fallbacks sensatos. */
export function t(value: Localized, locale: Locale, fallback: Locale = 'pt-BR'): string {
  if (typeof value === 'string') return value
  return value[locale] ?? value[fallback] ?? Object.values(value)[0] ?? ''
}

const FLAGS: Record<string, string> = {
  'pt-BR': 'br',
  en: 'us',
  'en-US': 'us',
  es: 'es',
  'es-ES': 'es'
}

export function flagCode(locale: Locale): string {
  return FLAGS[locale] ?? locale.slice(0, 2).toLowerCase()
}
