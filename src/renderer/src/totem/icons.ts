// Conjunto mínimo de ícones (stroke currentColor) usados pelos cards.
// Se `icone` for um caminho/URL (contém '/' ou '.'), o card usa <img> no lugar.

const P = 'stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"'

const ICONS: Record<string, string> = {
  info: `<circle cx="12" cy="12" r="9" ${P}/><line x1="12" y1="11" x2="12" y2="16" ${P}/><circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none"/>`,
  clock: `<circle cx="12" cy="12" r="9" ${P}/><path d="M12 7v5l3 2" ${P}/>`,
  grid: `<rect x="3" y="3" width="7" height="7" rx="1" ${P}/><rect x="14" y="3" width="7" height="7" rx="1" ${P}/><rect x="3" y="14" width="7" height="7" rx="1" ${P}/><rect x="14" y="14" width="7" height="7" rx="1" ${P}/>`,
  phone: `<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L20 13l1 4v2a2 2 0 0 1-2 2A16 16 0 0 1 3 7a2 2 0 0 1 2-3z" ${P}/>`,
  globe: `<circle cx="12" cy="12" r="9" ${P}/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" ${P}/>`,
  qr: `<rect x="3" y="3" width="7" height="7" ${P}/><rect x="14" y="3" width="7" height="7" ${P}/><rect x="3" y="14" width="7" height="7" ${P}/><path d="M14 14h3v3M20 14v7M14 20h3" ${P}/>`,
  pdf: `<path d="M6 2h8l4 4v16H6z" ${P}/><path d="M14 2v4h4" ${P}/><text x="12" y="17" font-size="6" fill="currentColor" stroke="none" text-anchor="middle">PDF</text>`,
  image: `<rect x="3" y="4" width="18" height="16" rx="2" ${P}/><circle cx="8.5" cy="9.5" r="1.5" ${P}/><path d="M4 18l5-5 4 4 3-3 4 4" ${P}/>`,
  star: `<path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9z" ${P}/>`
}

export function isImagePath(icone?: string): boolean {
  return !!icone && (icone.includes('/') || /\.(svg|png|jpe?g|webp|gif)$/i.test(icone))
}

export function iconSvg(name?: string): string {
  const body = (name && ICONS[name]) || ICONS.star
  return `<svg class="card__icon" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`
}
