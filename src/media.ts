import { runFFmpeg } from './ffmpeg'

export const SIZE = 512
const FPS = 20

export type Visual = {
  /** Largo propio de la animación en segundos; 0 si es una imagen fija. */
  duration: number
  width: number
  height: number
  frameAt: (time: number) => Promise<CanvasImageSource>
  dispose: () => void
  /** Otra lectura del mismo material, que se puede recorrer a la vez. */
  clone: () => Promise<Visual>
}

export type Background = 'white' | 'black' | 'none'
export type Style = {
  fit: 'cover' | 'contain'
  background: Background
  text: string
  /** Color `#rrggbb` que se vuelve transparente, o null para no quitar ninguno. */
  key: string | null
  /** Cuánto se puede alejar un píxel del color elegido, de 0 a 100. */
  tolerance: number
  /** Posición de la imagen: acercamiento, desplazamiento en píxeles del sticker y giro en grados. */
  zoom: number
  x: number
  y: number
  rotate: number
  /** Grosor del borde alrededor de lo que no es transparente; 0 es sin borde. */
  outline: number
  outlineColor: string
  textColor: string
  textSize: number
  /** Altura del centro del texto, de 0 (arriba) a 1 (abajo). */
  textY: number
  emojis: { char: string; x: number; y: number }[]
  /** Trazos de la goma, en píxeles de la imagen original medidos desde su centro. */
  erased: Stroke[]
}

export type Stroke = { size: number; points: [number, number][] }

export const EMOJI_SIZE = 96

export const defaultStyle: Style = {
  fit: 'cover',
  background: 'black',
  text: '',
  key: null,
  tolerance: 20,
  zoom: 1,
  x: 0,
  y: 0,
  rotate: 0,
  outline: 0,
  outlineColor: '#ffffff',
  textColor: '#ffffff',
  textSize: 56,
  textY: 0.9,
  emojis: [],
  erased: [],
}

export const isVideo = (file: File) =>
  file.type.startsWith('video/') || /\.(mp4|mov|mkv|avi|webm|3gp|m4v)$/i.test(file.name)

export async function loadVisual(file: File): Promise<Visual> {
  if (isVideo(file)) {
    // Si el navegador no sabe abrirlo (HEVC, MKV, AVI...), ffmpeg lo convierte primero.
    return loadVideo(file).catch(async () => loadVideo(await normalizeVideo(file)))
  }
  if (file.type === 'image/gif' && 'ImageDecoder' in window) return loadGif(file)

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('readImage')
  })
  const still: Visual = {
    duration: 0,
    width: bitmap.width,
    height: bitmap.height,
    frameAt: async () => bitmap,
    dispose: () => bitmap.close(),
    // Los cuadros ya decodificados no cambian: se pueden compartir.
    clone: async () => ({ ...still, dispose: () => {} }),
  }
  return still
}

async function normalizeVideo(file: File) {
  return runFFmpeg(
    { source: new Uint8Array(await file.arrayBuffer()) },
    ['-i', 'source', '-t', '60', '-an',
      '-vf', 'scale=720:720:force_original_aspect_ratio=decrease:force_divisible_by=2',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '14', '-pix_fmt', 'yuv420p'],
    'normalized.mp4',
    'video/mp4',
  )
}

async function loadVideo(file: Blob): Promise<Visual> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  await new Promise<void>((resolve, reject) => {
    const fail = () => {
      URL.revokeObjectURL(url)
      reject(new Error('readVideo'))
    }
    video.onloadeddata = () => (video.videoWidth ? resolve() : fail())
    video.onerror = fail
    video.src = url
  })
  const duration = Number.isFinite(video.duration) ? video.duration : 0

  return {
    duration,
    width: video.videoWidth,
    height: video.videoHeight,
    frameAt: async (time) => {
      const target = duration ? time % duration : 0
      if (Math.abs(video.currentTime - target) > 0.001) {
        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve()
          video.currentTime = target
        })
      }
      return video
    },
    dispose: () => URL.revokeObjectURL(url),
    clone: () => loadVideo(file),
  }
}

async function loadGif(file: File): Promise<Visual> {
  const decoder = new ImageDecoder({ data: await file.arrayBuffer(), type: file.type })
  await decoder.tracks.ready
  await decoder.completed
  const count = Math.min(decoder.tracks.selectedTrack?.frameCount ?? 1, 300)

  const frames: { bitmap: ImageBitmap; end: number }[] = []
  let total = 0
  for (let index = 0; index < count; index++) {
    const { image } = await decoder.decode({ frameIndex: index })
    total += (image.duration ?? 100_000) / 1_000_000
    frames.push({ bitmap: await createImageBitmap(image), end: total })
    image.close()
  }
  decoder.close()

  const gif: Visual = {
    duration: count > 1 ? total : 0,
    width: frames[0].bitmap.width,
    height: frames[0].bitmap.height,
    frameAt: async (time) => {
      const at = time % total
      return (frames.find((frame) => at < frame.end) ?? frames[0]).bitmap
    },
    dispose: () => frames.forEach((frame) => frame.bitmap.close()),
    clone: async () => ({ ...gif, dispose: () => {} }),
  }
  return gif
}

let layer: CanvasRenderingContext2D | null = null
let silhouette: CanvasRenderingContext2D | null = null

const surface = (options?: CanvasRenderingContext2DSettings) => {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  return canvas.getContext('2d', options)!
}

/** Cuántos píxeles del sticker ocupa un píxel de la imagen. */
export const imageScale = (visual: Visual, style: Style) =>
  (style.fit === 'cover' ? Math.max : Math.min)(SIZE / visual.width, SIZE / visual.height) * style.zoom

/** Pasa un punto del sticker a coordenadas de la imagen: así lo borrado la acompaña si se mueve. */
export function toImagePoint(visual: Visual, style: Style, x: number, y: number): [number, number] {
  const angle = (-style.rotate * Math.PI) / 180
  const dx = x - SIZE / 2 - style.x
  const dy = y - SIZE / 2 - style.y
  const scale = imageScale(visual, style)
  return [
    (dx * Math.cos(angle) - dy * Math.sin(angle)) / scale,
    (dx * Math.sin(angle) + dy * Math.cos(angle)) / scale,
  ]
}

function erase(context: CanvasRenderingContext2D, strokes: Stroke[]) {
  context.globalCompositeOperation = 'destination-out'
  context.lineCap = context.lineJoin = 'round'
  context.strokeStyle = context.fillStyle = '#000'
  for (const { size, points } of strokes) {
    const [first, ...rest] = points
    // El punto inicial es un círculo, para que un toque solo también borre.
    context.beginPath()
    context.arc(first[0], first[1], size / 2, 0, Math.PI * 2)
    context.fill()
    context.lineWidth = size
    context.beginPath()
    context.moveTo(...first)
    for (const point of rest) context.lineTo(...point)
    context.stroke()
  }
}

/** La imagen sola, ya encuadrada y sin fondo ni texto. */
function drawSource(source: CanvasImageSource, visual: Visual, style: Style) {
  layer ??= surface({ willReadFrequently: true })
  const scale = imageScale(visual, style)
  const width = visual.width * scale
  const height = visual.height * scale
  layer.clearRect(0, 0, SIZE, SIZE)
  layer.save()
  layer.translate(SIZE / 2 + style.x, SIZE / 2 + style.y)
  layer.rotate((style.rotate * Math.PI) / 180)
  layer.drawImage(source, -width / 2, -height / 2, width, height)
  if (style.erased.length) {
    layer.scale(scale, scale)
    erase(layer, style.erased)
  }
  layer.restore()
  return layer
}

/** Borde de sticker: la silueta pintada de un color, repetida alrededor. */
function drawOutline(context: CanvasRenderingContext2D, image: HTMLCanvasElement, size: number, color: string) {
  silhouette ??= surface()
  silhouette.globalCompositeOperation = 'source-over'
  silhouette.clearRect(0, 0, SIZE, SIZE)
  silhouette.drawImage(image, 0, 0)
  silhouette.globalCompositeOperation = 'source-in'
  silhouette.fillStyle = color
  silhouette.fillRect(0, 0, SIZE, SIZE)
  for (let step = 0; step < 32; step++) {
    const angle = (step / 32) * Math.PI * 2
    context.drawImage(silhouette.canvas, Math.cos(angle) * size, Math.sin(angle) * size)
  }
}

function removeColor(context: CanvasRenderingContext2D, color: string, tolerance: number) {
  const [red, green, blue] = [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16))
  const image = context.getImageData(0, 0, SIZE, SIZE)
  const { data } = image
  const limit = (tolerance / 100) * 255
  // Franja de transición para que el borde no quede dentado.
  const feather = 24
  for (let i = 0; i < data.length; i += 4) {
    const distance = Math.max(Math.abs(data[i] - red), Math.abs(data[i + 1] - green), Math.abs(data[i + 2] - blue))
    if (distance <= limit) data[i + 3] = 0
    else if (distance < limit + feather) data[i + 3] *= (distance - limit) / feather
  }
  context.putImageData(image, 0, 0)
}

/** Color de la imagen en un punto de la vista previa, o null si ahí no hay imagen. */
export function pickColor(source: CanvasImageSource, visual: Visual, style: Style, x: number, y: number) {
  const [red, green, blue, alpha] = drawSource(source, visual, style).getImageData(x, y, 1, 1).data
  if (!alpha) return null
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

export function draw(canvas: HTMLCanvasElement, source: CanvasImageSource, visual: Visual, style: Style) {
  const context = canvas.getContext('2d')!
  context.clearRect(0, 0, SIZE, SIZE)
  if (style.background !== 'none') {
    context.fillStyle = style.background
    context.fillRect(0, 0, SIZE, SIZE)
  }

  const image = drawSource(source, visual, style)
  if (style.key) removeColor(image, style.key, style.tolerance)
  if (style.outline) drawOutline(context, image.canvas, style.outline, style.outlineColor)
  context.drawImage(image.canvas, 0, 0)

  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = '#000'
  context.font = `${EMOJI_SIZE}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`
  for (const emoji of style.emojis) context.fillText(emoji.char, emoji.x, emoji.y)

  const text = style.text.trim().toUpperCase()
  if (!text) return
  context.font = `900 ${style.textSize}px Impact, "Arial Black", sans-serif`
  context.lineJoin = 'round'
  context.lineWidth = style.textSize * 0.18
  context.strokeStyle = style.textColor === '#000000' ? '#fff' : '#000'
  context.fillStyle = style.textColor
  context.strokeText(text, SIZE / 2, style.textY * SIZE, SIZE - 32)
  context.fillText(text, SIZE / 2, style.textY * SIZE, SIZE - 32)
}

export async function decodeAudio(file: Blob): Promise<AudioBuffer> {
  const context = new AudioContext()
  try {
    return await context.decodeAudioData(await file.arrayBuffer())
  } catch {
    throw new Error('readAudio')
  } finally {
    await context.close()
  }
}

export function sliceAudio(audio: AudioBuffer, start: number, length: number): AudioBuffer {
  const from = Math.floor(start * audio.sampleRate)
  const samples = Math.max(1, Math.min(Math.floor(length * audio.sampleRate), audio.length - from))
  const channels = Math.min(audio.numberOfChannels, 2)
  const slice = new AudioBuffer({ length: samples, numberOfChannels: channels, sampleRate: audio.sampleRate })
  for (let channel = 0; channel < channels; channel++) {
    slice.copyToChannel(audio.getChannelData(channel).slice(from, from + samples), channel)
  }
  return slice
}

/** PCM de 16 bits: la forma más simple de pasarle el recorte a ffmpeg. */
function toWav(audio: AudioBuffer): Uint8Array {
  const channels = audio.numberOfChannels
  const bytes = audio.length * channels * 2
  const view = new DataView(new ArrayBuffer(44 + bytes))
  const tag = (at: number, value: string) => [...value].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)))
  tag(0, 'RIFF')
  view.setUint32(4, 36 + bytes, true)
  tag(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, audio.sampleRate, true)
  view.setUint32(28, audio.sampleRate * channels * 2, true)
  view.setUint16(32, channels * 2, true)
  view.setUint16(34, 16, true)
  tag(36, 'data')
  view.setUint32(40, bytes, true)
  const data = Array.from({ length: channels }, (_, channel) => audio.getChannelData(channel))
  let at = 44
  for (let i = 0; i < audio.length; i++) {
    for (let channel = 0; channel < channels; channel++, at += 2) {
      view.setInt16(at, Math.max(-1, Math.min(1, data[channel][i])) * 0x7fff, true)
    }
  }
  return new Uint8Array(view.buffer)
}

export const toPng = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('png'))), 'image/png'),
  )

/** Un sticker estático de WhatsApp pesa como mucho 100 KB. Null si el navegador no sabe generar WebP. */
export async function toWebp(canvas: HTMLCanvasElement): Promise<Blob | null> {
  let blob: Blob | null = null
  for (let quality = 0.95; quality > 0.1; quality -= 0.1) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
    if (blob?.type !== 'image/webp') return null
    if (blob.size <= 100 * 1024) break
  }
  return blob
}

/**
 * Video cuadrado de `duration` segundos, con o sin audio. Con fondo sale MP4 (H.264 + AAC) hecho con ffmpeg,
 * con calidad constante (CRF): pesa poco sin pérdida visible. Sin fondo sale WebM, porque MP4 no guarda transparencia.
 */
export async function exportVideo(
  visual: Visual,
  style: Style,
  duration: number,
  audio: AudioBuffer | null,
  offset: number,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE

  if (style.background === 'none') {
    const { encodeTransparent } = await import('./transparent')
    const drawFrame = async (time: number) => {
      signal.throwIfAborted()
      draw(canvas, await visual.frameAt(offset + time), visual, style)
    }
    return encodeTransparent(canvas, audio, duration, FPS, drawFrame, onProgress)
  }

  // Una imagen fija necesita un solo cuadro, que ffmpeg repite.
  const still = !visual.duration
  const total = still ? 1 : Math.ceil(duration * FPS)
  const files: Record<string, Uint8Array> = audio ? { 'audio.wav': toWav(audio) } : {}
  for (let index = 0; index < total; index++) {
    signal.throwIfAborted()
    draw(canvas, await visual.frameAt(offset + index / FPS), visual, style)
    files[`f${String(index).padStart(5, '0')}.png`] = new Uint8Array(await (await toPng(canvas)).arrayBuffer())
    onProgress(((index + 1) / total) * 0.4)
  }

  const input = still
    ? ['-loop', '1', '-framerate', '10', '-i', 'f00000.png']
    : ['-framerate', String(FPS), '-i', 'f%05d.png']
  const codec = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '23', ...(still ? ['-tune', 'stillimage'] : []),
    '-pix_fmt', 'yuv420p', ...(audio ? ['-c:a', 'aac', '-b:a', '96k'] : ['-an']), '-movflags', '+faststart']

  return runFFmpeg(
    files,
    [...input, ...(audio ? ['-i', 'audio.wav'] : []), ...codec, '-t', duration.toFixed(3)],
    'sticker.mp4',
    'video/mp4',
    (fraction) => onProgress(0.4 + fraction * 0.6),
    signal,
  )
}

/** Solo el audio recortado (.m4a), para adjuntarlo a un sticker de foto. */
export const exportAudio = (audio: AudioBuffer, signal: AbortSignal) =>
  runFFmpeg(
    { 'audio.wav': toWav(audio) },
    ['-i', 'audio.wav', '-c:a', 'aac', '-b:a', '96k'],
    'audio.m4a',
    'audio/mp4',
    undefined,
    signal,
  )
