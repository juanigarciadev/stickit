import info from './assets/sprites/info.json'

// Solo se importan las direcciones: cada archivo se baja recién cuando algo lo pide.
// Al pasar por Vite quedan con un hash en el nombre, así se pueden cachear para siempre (ver vercel.json).
const gifs = import.meta.glob<string>('./assets/gifs/*.webp', { eager: true, query: '?url', import: 'default' })
const sprites = import.meta.glob<string>('./assets/sprites/*.webp', { eager: true, query: '?url', import: 'default' })

/** Orden al azar, distinto en cada carga de la página. */
const names = Object.keys(info) as (keyof typeof info)[]
for (let i = names.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1))
  ;[names[i], names[j]] = [names[j], names[i]]
}

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Con "reducir movimiento" activado no se muestran: quedan los emojis, que no se mueven. */
export const heroGifs = reducedMotion ? [] : names.slice(0, 5).map((name) => gifs[`./assets/gifs/${name}.webp`])

/**
 * El de la tarjeta de cierre (uno que no está en el hero), como grilla de cuadros: un WebP animado
 * no se puede adelantar, y así se muestra el cuadro que corresponde a cada punto de la onda.
 */
export const closingGif = { ...info[names[5]], url: sprites[`./assets/sprites/${names[5]}.webp`], columns: 8 }
