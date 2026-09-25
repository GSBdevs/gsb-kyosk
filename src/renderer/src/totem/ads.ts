// Carrossel da faixa de publicidade 16:9.
// Suporta imagem e vídeo, pré-carrega o próximo item e faz crossfade.

import type { AdItem, Publicidade } from '../types'
import { isVideo } from '../config-source'

export interface AdsController {
  el: HTMLElement
  destroy(): void
}

export function createAds(pub: Publicidade, itens: AdItem[]): AdsController {
  const root = document.createElement('div')
  root.className = 'ads'
  root.dataset.fit = pub.ajuste

  let timer: number | undefined
  let index = 0
  const slides: HTMLElement[] = []

  const list = itens.length ? itens : []
  for (const item of list) {
    const slide = document.createElement('div')
    slide.className = 'ads__item'
    if (isVideo(item.arquivo) || item.tipo === 'video') {
      const v = document.createElement('video')
      v.src = item.arquivo
      v.muted = true // autoplay só funciona mudo
      v.playsInline = true
      v.preload = 'auto'
      v.loop = list.length === 1 // um só item = loop contínuo
      slide.appendChild(v)
    } else {
      const img = document.createElement('img')
      img.src = item.arquivo
      img.alt = 'Publicidade'
      img.loading = 'eager'
      slide.appendChild(img)
    }
    slides.push(slide)
    root.appendChild(slide)
  }

  function clearTimer(): void {
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timer = undefined
    }
  }

  function show(i: number): void {
    if (!slides.length) return
    clearTimer()
    slides.forEach((s, k) => s.classList.toggle('is-active', k === i))
    index = i

    const item = list[i]
    const slide = slides[i]
    const video = slide.querySelector('video')

    if (video) {
      video.currentTime = 0
      void video.play().catch(() => undefined)
      if (list.length > 1) {
        video.onended = () => next()
      }
    } else {
      const secs = item.duracaoSegundos ?? pub.intervaloSegundos
      if (list.length > 1) {
        timer = window.setTimeout(next, Math.max(1, secs) * 1000)
      }
    }
  }

  function next(): void {
    show((index + 1) % slides.length)
  }

  if (slides.length) show(0)

  return {
    el: root,
    destroy() {
      clearTimer()
      slides.forEach((s) => {
        const v = s.querySelector('video')
        if (v) {
          v.onended = null
          v.pause()
        }
      })
    }
  }
}
