import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { Alert } from '@blossomui/react/alert'
import { Button } from '@blossomui/react/button'
import { FileUpload } from '@blossomui/react/file-upload'
import { Footer } from '@blossomui/react/footer'
import { Navbar } from '@blossomui/react/navbar'
import { ProgressBar } from '@blossomui/react/progress-bar'
import { SegmentedControl } from '@blossomui/react/segmented-control'
import { Stepper } from '@blossomui/react/stepper'
import { zipSync } from 'fflate'
import { Download, FileArchive, Image, Mic, Music, Sparkles, Square, Sticker, X } from 'lucide-react'
import { initialLanguage, texts, type ErrorCode, type Language } from './i18n'
import { AnimatedMenu } from './AnimatedMenu'
import { Controls } from './Controls'
import { Landing } from './Landing'
import { PreviewStage } from './PreviewStage'
import { Reveal } from './Reveal'
import {
  SIZE,
  decodeAudio,
  draw,
  exportAudio,
  exportVideo,
  isVideo,
  loadVisual,
  pickColor,
  imageScale,
  toImagePoint,
  defaultStyle,
  EMOJI_SIZE,
  sliceAudio,
  toPng,
  toWebp,
  type Style,
  type Visual,
} from './media'
import { Trim, getPeaks } from './Trim'
import { LIVE_BARS, MAX_SECONDS, useRecorder } from './useRecorder'

const MAX_TOTAL = 60
const MAX_ANIMATION = 10

type Mode = 'silent' | 'sound'
type AudioOrigin = 'file' | 'mic' | 'video'
type Output = { name: string; url: string; size: number; kind: 'video' | 'audio' | 'image' }
/** Un sticker generado: sus archivos descargables. */
type Result = { name: string; seconds: number; files: Output[] }

const errorCode = (error: unknown) => (error instanceof Error ? error.message : 'unknown')
const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
const round = (value: number) => Math.round(value * 10) / 10
const footerLink = 'font-medium underline underline-offset-2'
const brushCursor = (size: number) => {
  const half = size / 2
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><circle cx='${half}' cy='${half}' r='${half - 1}' fill='none' stroke='white'/><circle cx='${half}' cy='${half}' r='${half - 2}' fill='none' stroke='black'/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${half} ${half}, crosshair`
}
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
const link =
  'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--blossom-accent)]'
const icons = { video: Download, audio: Music, image: Image }

const output = (name: string, blob: Blob, kind: Output['kind']): Output => ({
  name,
  url: URL.createObjectURL(blob),
  size: blob.size,
  kind,
})

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export default function App() {
  const [language, setLanguage] = useState<Language>(initialLanguage)
  const t = texts[language]
  const translate = (code: string) => t.errors[code as ErrorCode] ?? t.errors.unknown

  const [mode, setMode] = useState<Mode>('silent')
  const [hash, setHash] = useState(location.hash)
  const [scrolled, setScrolled] = useState(false)
  const [visual, setVisual] = useState<Visual | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [origin, setOrigin] = useState<AudioOrigin>('file')
  const [audio, setAudio] = useState<AudioBuffer | null>(null)
  const [style, setStyle] = useState<Style>(defaultStyle)
  const [pasted, setPasted] = useState(0)
  const [erasing, setErasing] = useState(false)
  const [brush, setBrush] = useState(48)
  const [expanded, setExpanded] = useState(false)
  const [viewZoom, setViewZoom] = useState(1)
  const [videoStart, setVideoStart] = useState(0)
  const [videoPeaks, setVideoPeaks] = useState<number[]>()
  const [clip, setClip] = useState(MAX_ANIMATION)
  const [start, setStart] = useState(0)
  const [total, setTotal] = useState(10)
  const [partLength, setPartLength] = useState(10)
  const [progress, setProgress] = useState<number | null>(null)
  const [results, setResults] = useState<Result[]>([])
  const [reading, setReading] = useState(false)
  // Se guardan códigos y no textos, para que cambien con el idioma.
  const [error, setError] = useState('')
  const [audioError, setAudioError] = useState('')
  const [playing, setPlaying] = useState(false)

  const canvas = useRef<HTMLCanvasElement>(null)
  const lastFrame = useRef<CanvasImageSource | null>(null)
  // Lo que se está arrastrando en la vista previa.
  const drag = useRef<{ target: 'image' | 'text' | 'eraser' | number; x: number; y: number; moved: boolean } | null>(
    null,
  )
  const job = useRef<AbortController | null>(null)
  const resultsBox = useRef<HTMLDivElement>(null)
  const player = useRef<{ context: AudioContext; source: AudioBufferSourceNode } | null>(null)
  // Si se elige otro archivo mientras se lee el anterior, el viejo se descarta.
  const visualRequest = useRef(0)
  const audioRequest = useRef(0)

  const withSound = mode === 'sound'
  const animated = !!visual?.duration
  const length = audio ? Math.min(total, MAX_TOTAL, audio.duration - start) : 0
  // Un resto de menos de medio segundo no justifica otro sticker.
  const count = withSound && audio ? Math.max(1, Math.ceil((length - 0.5) / partLength)) : 1
  const clipLength = visual ? Math.min(clip, MAX_ANIMATION, visual.duration - videoStart) : 0
  // Si el sonido es el del video, imagen y audio arrancan en el mismo punto.
  const linked = withSound && origin === 'video'
  const from = animated ? (linked ? start : videoStart) : 0

  const peaks = useMemo(() => audio && getPeaks(audio), [audio])

  useEffect(() => {
    localStorage.setItem('language', language)
    document.documentElement.lang = language
    document.title = texts[language].documentTitle
  }, [language])

  // Dos pantallas según la dirección: la portada y el editor.
  const editing = hash === '#crear'

  useEffect(() => {
    const update = () => setHash(location.hash)
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  // La barra de arriba solo toma fondo cuando hay contenido pasando por debajo.
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  useEffect(() => {
    const section = (hash === '#como' || hash === '#preguntas') && document.getElementById(hash.slice(1))
    if (section) section.scrollIntoView({ behavior: 'smooth' })
    else window.scrollTo(0, 0)
  }, [hash])

  const stopPlayback = () => {
    const current = player.current
    player.current = null
    if (current) void current.context.close()
    setPlaying(false)
  }

  const play = () => {
    if (!audio) return
    if (player.current) return stopPlayback()
    const context = new AudioContext()
    const source = context.createBufferSource()
    source.buffer = audio
    source.connect(context.destination)
    source.onended = () => player.current?.source === source && stopPlayback()
    source.start(0, start, length)
    player.current = { context, source }
    setPlaying(true)
  }

  const useAudio = async (blob: Blob | null) => {
    const request = ++audioRequest.current
    stopPlayback()
    setAudio(null)
    setAudioError('')
    if (!blob) return
    try {
      const decoded = await decodeAudio(blob)
      if (request !== audioRequest.current) return
      setAudio(decoded)
      setStart(0)
      setTotal(round(Math.min(decoded.duration, 10)))
    } catch (reason) {
      if (request === audioRequest.current) setAudioError(errorCode(reason))
    }
  }

  const useVisual = async (file: File | null) => {
    const request = ++visualRequest.current
    setError('')
    setVisual(null)
    setVideoStart(0)
    setClip(MAX_ANIMATION)
    setStyle((current) => ({ ...current, zoom: 1, x: 0, y: 0, rotate: 0, erased: [] }))
    setErasing(false)
    setVideoPeaks(undefined)
    lastFrame.current = null
    const video = file && isVideo(file) ? file : null
    setVideoFile(video)
    if (video) {
      setOrigin('video')
      void useAudio(video)
      decodeAudio(video)
        .then((decoded) => request === visualRequest.current && setVideoPeaks(getPeaks(decoded)))
        .catch(() => {})
    } else if (origin === 'video') {
      setOrigin('file')
      void useAudio(null)
    }
    setReading(!!file)
    if (!file) return
    try {
      const loaded = await loadVisual(file)
      if (request !== visualRequest.current) return loaded.dispose()
      setVisual(loaded)
    } catch (reason) {
      if (request === visualRequest.current) setError(errorCode(reason))
    } finally {
      if (request === visualRequest.current) setReading(false)
    }
  }

  const changeOrigin = (value: string) => {
    setOrigin(value as AudioOrigin)
    void useAudio(value === 'video' ? videoFile : null)
  }

  const changeMode = (value: string) => {
    stopPlayback()
    recorder.stop()
    setError('')
    setMode(value as Mode)
  }

  const recorder = useRecorder((blob) => void useAudio(blob), setAudioError)

  useEffect(() => () => visual?.dispose(), [visual])

  // Vista previa animada.
  useEffect(() => {
    if (!visual || progress !== null) return
    let cancelled = false
    let timer = 0
    const began = performance.now()
    // La vista previa repite el mismo tramo que va a salir en el sticker.
    const loop = (withSound ? Math.min(length || visual.duration, partLength) : clipLength) || 1
    const tick = async () => {
      const frame = await visual.frameAt(from + (((performance.now() - began) / 1000) % loop))
      if (cancelled || !canvas.current) return
      lastFrame.current = frame
      draw(canvas.current, frame, visual, style)
      timer = window.setTimeout(tick, visual.duration ? 50 : 500)
    }
    void tick()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [visual, style, progress, from, length, partLength, withSound, clipLength])

  // Los resultados viejos dejan de valer si cambia cualquier ajuste.
  useEffect(() => setResults([]), [mode, visual, audio, style, start, total, partLength, from, clip])
  // Libera los archivos que dejaron de estar en la lista (la lista crece mientras se genera).
  const urls = useRef<string[]>([])
  useEffect(() => {
    const current = results.flatMap((result) => result.files.map((file) => file.url))
    urls.current.filter((url) => !current.includes(url)).forEach((url) => URL.revokeObjectURL(url))
    urls.current = current
  }, [results])
  // Quedan abajo: se los trae a la vista cuando están listos.
  useEffect(() => {
    if (results.length === 1) resultsBox.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [results])

  const generate = async () => {
    if (!visual || (withSound && !audio)) return
    stopPlayback()
    setError('')
    setProgress(0)
    setResults([])
    const controller = new AbortController()
    const { signal } = controller
    job.current = controller
    const done: Result[] = []
    const report = (index: number) => (fraction: number) => {
      if (!signal.aborted) setProgress(((index + fraction) / count) * 100)
    }
    // La imagen fija tal como se ve: PNG, y WebP si no pasa por el audio.
    const still = async () => {
      const target = document.createElement('canvas')
      target.width = target.height = SIZE
      draw(target, await visual.frameAt(from), visual, style)
      return target
    }
    try {
      if (withSound && audio) {
        for (let index = 0; index < count; index++) {
          const offset = index * partLength
          const slice = sliceAudio(audio, start + offset, Math.min(partLength, length - offset))
          const name = count > 1 ? `sticker-${index + 1}` : 'sticker'
          const video = await exportVideo(visual, style, slice.duration, slice, from + offset, report(index), signal)
          // El audio suelto y la imagen solo sirven para el camino "foto + audio" de WhatsApp.
          // Con un video o un GIF, el sonido ya va dentro del video.
          const sound = animated ? null : await exportAudio(slice, signal)
          const image = !animated && index === 0 ? await toPng(await still()) : null
          signal.throwIfAborted()
          const extension = video.type === 'video/webm' ? 'webm' : 'mp4'
          const files = [output(`${name}.${extension}`, video, 'video')]
          if (sound) files.push(output(`${name}.m4a`, sound, 'audio'))
          if (image) files.push(output('sticker.png', image, 'image'))
          done.push({ name, seconds: slice.duration, files })
          // Cada sticker aparece apenas está listo.
          setResults([...done])
        }
      } else if (animated) {
        const video = await exportVideo(visual, style, clipLength, null, from, report(0), signal)
        const extension = video.type === 'video/webm' ? 'webm' : 'mp4'
        done.push({ name: 'sticker', seconds: clipLength, files: [output(`sticker.${extension}`, video, 'video')] })
      } else {
        const target = await still()
        const files = [output('sticker.png', await toPng(target), 'image')]
        const webp = await toWebp(target)
        if (webp) files.push(output('sticker.webp', webp, 'image'))
        done.push({ name: 'sticker', seconds: 0, files })
      }
      signal.throwIfAborted()
      setResults(done)
    } catch (reason) {
      // Los que ya salieron se conservan, aunque se cancele o falle uno.
      if (!signal.aborted) setError(errorCode(reason))
    } finally {
      // Un proceso cancelado no debe tocar el estado del que lo reemplazó.
      if (job.current === controller) setProgress(null)
    }
  }

  const cancel = () => {
    job.current?.abort()
    job.current = null
    setProgress(null)
  }

  const downloadZip = async () => {
    const files = await Promise.all(
      results
        .flatMap((result) => result.files)
        .map(async ({ name, url }) => [name, new Uint8Array(await (await fetch(url)).arrayBuffer())] as const),
    )
    // Sin compresión: video, audio e imágenes ya vienen comprimidos.
    const zip = zipSync(Object.fromEntries(files), { level: 0 })
    const anchor = document.createElement('a')
    anchor.href = URL.createObjectURL(new Blob([zip.slice()], { type: 'application/zip' }))
    anchor.download = 'stickers.zip'
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(anchor.href), 10_000)
  }

  /** Punto del sticker (0 a 512) que corresponde a un evento sobre la vista previa. */
  const pointAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const scale = (offset: number, size: number) => Math.min(SIZE - 1, Math.max(0, Math.floor((offset / size) * SIZE)))
    return { x: scale(event.clientX - box.left, box.width), y: scale(event.clientY - box.top, box.height) }
  }

  // Se agarra lo que está más arriba: un emoji, el texto o, si no, la imagen.
  const startDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!visual || progress !== null) return
    const point = pointAt(event)
    event.currentTarget.setPointerCapture(event.pointerId)
    if (erasing) {
      // El grosor también va en píxeles de la imagen, para que no cambie al hacer zoom después.
      const stroke = {
        size: brush / viewZoom / imageScale(visual, style),
        points: [toImagePoint(visual, style, point.x, point.y)],
      }
      drag.current = { target: 'eraser', ...point, moved: true }
      setStyle((value) => ({ ...value, erased: [...value.erased, stroke] }))
      return
    }
    const emoji = style.emojis.findLastIndex((item) => Math.hypot(item.x - point.x, item.y - point.y) < EMOJI_SIZE / 2)
    const onText = style.text.trim() && Math.abs(point.y - style.textY * SIZE) < style.textSize / 2 + 8
    drag.current = { target: emoji >= 0 ? emoji : onText ? 'text' : 'image', ...point, moved: false }
  }

  const moveDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    const current = drag.current
    if (!current) return
    const point = pointAt(event)
    if (current.target === 'eraser') {
      if (!visual) return
      const next = toImagePoint(visual, style, point.x, point.y)
      setStyle((value) => {
        const last = value.erased[value.erased.length - 1]
        const grown = { ...last, points: [...last.points, next] }
        return { ...value, erased: [...value.erased.slice(0, -1), grown] }
      })
      return
    }
    const dx = point.x - current.x
    const dy = point.y - current.y
    // Un temblor mínimo sigue contando como un toque.
    if (!current.moved && Math.hypot(dx, dy) < 4) return
    drag.current = { ...current, ...point, moved: true }
    const { target } = current
    setStyle((value) => {
      if (target === 'image') return { ...value, x: value.x + dx, y: value.y + dy }
      if (target === 'text') return { ...value, textY: Math.min(0.95, Math.max(0.05, value.textY + dy / SIZE)) }
      const emojis = value.emojis.map((item, i) => (i === target ? { ...item, x: item.x + dx, y: item.y + dy } : item))
      return { ...value, emojis }
    })
  }

  // Un toque sin arrastrar toma el color, cuando se está quitando uno.
  const endDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    const current = drag.current
    drag.current = null
    if (!current || current.moved || !visual || !lastFrame.current || style.key === null) return
    const { x, y } = pointAt(event)
    const key = pickColor(lastFrame.current, visual, style, x, y)
    if (key) setStyle({ ...style, key })
  }

  // Pegar una imagen con Ctrl+V.
  const pasteRef = useRef<(event: ClipboardEvent) => void>(() => {})
  pasteRef.current = (event) => {
    const file = Array.from(event.clipboardData?.files ?? []).find((item) => /^(image|video)\//.test(item.type))
    if (!editing || progress !== null || !file) return
    event.preventDefault()
    // Vacía la lista del selector, que no sabe de este archivo.
    setPasted((value) => value + 1)
    void useVisual(file)
  }
  useEffect(() => {
    const paste = (event: ClipboardEvent) => pasteRef.current(event)
    window.addEventListener('paste', paste)
    return () => window.removeEventListener('paste', paste)
  }, [])

  // En pantallas táctiles la goma se usa a pantalla completa, que ahí hace falta.
  const toggleErasing = (next: boolean) => {
    setErasing(next)
    if (next && window.matchMedia('(pointer: coarse)').matches) setExpanded(true)
  }

  const openEditor = (next: Mode) => {
    changeMode(next)
    location.hash = 'crear'
  }

  const busy = progress !== null
  // Mientras se genera no se puede tocar nada de los ajustes: cambiarlos descartaría lo ya hecho.
  const lock = busy ? ({ inert: '' } as object) : {}
  // Hasta que no hay un archivo, solo se muestra por dónde empezar.
  const ready = !!visual
  const removeLabel = { remove: t.remove }
  const files = results.flatMap((result) => result.files)

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 pb-10 pt-4 lg:max-w-7xl">
        <AnimatedMenu>
          <Navbar
            sticky
            className={`transition-colors duration-300 ${scrolled ? 'shadow-lg' : 'nav-clear'}`}
            brand={
              <a href="#" className="flex items-center gap-2">
                <span className="flex items-center rounded-xl bg-[var(--blossom-accent)] p-1.5 text-[var(--blossom-accent-contrast)]">
                  <Sticker size={18} aria-hidden />
                </span>
                StickIt
              </a>
            }
            links={[
              { label: t.create, href: '#crear', active: editing },
              { label: t.howTo, href: '#como' },
            ]}
            labels={t.nav}
            alwaysVisibleActions={
              <SegmentedControl
                label={t.language}
                size="sm"
                options={[
                  { value: 'es', label: 'ES' },
                  { value: 'en', label: 'EN' },
                ]}
                value={language}
                onChange={(value) => setLanguage(value as Language)}
              />
            }
          />
        </AnimatedMenu>

        {!editing && <Landing t={t.landing} onStart={openEditor} />}

        {/* El editor queda montado para no perder el trabajo al volver a la portada. */}
        <main
          className={
            editing ? 'flex flex-1 flex-col gap-5 lg:grid lg:grid-cols-3 lg:content-start lg:items-start' : 'hidden'
          }
        >
          <h1 className="sr-only">{t.title}</h1>
          <div className="anim-down lg:col-span-3">
            <SegmentedControl
              label={t.mode}
              fullWidth
              size="lg"
              disabled={busy}
              options={[
                { value: 'silent', label: t.silent },
                { value: 'sound', label: t.sound },
              ]}
              value={mode}
              onChange={changeMode}
            />
          </div>

          {withSound && (
            <div className="anim-down lg:col-span-3">
              <Alert color="yellow" showIcon>
                {t.beta}
              </Alert>
            </div>
          )}

          <fieldset disabled={busy} className="contents">
            <div
              {...lock}
              className={`anim-up flex min-w-0 flex-col gap-5 ${ready ? '' : 'mx-auto w-full max-w-xl lg:col-span-3'}`}
            >
              <Section title={`1. ${t.visualTitle}`}>
                <FileUpload
                  key={pasted}
                  accept="image/*,video/*,.mkv,.avi,.mov"
                  label={t.visualLabel}
                  hint={t.pasteHint}
                  labels={removeLabel}
                  onChange={(chosen) => void useVisual(chosen[0] ?? null)}
                />
                {pasted > 0 && visual && (
                  <Button
                    className="w-full"
                    color="secondary"
                    icon={<X size={16} />}
                    onClick={() => {
                      setPasted(0)
                      void useVisual(null)
                    }}
                  >
                    {t.remove(t.pasted)}
                  </Button>
                )}
                {reading && <p className="text-sm text-neutral-500">{t.reading}</p>}
              </Section>

              {/* Se oculta sin desmontar, para no perder el archivo elegido al cambiar de modo. */}
              <div className={withSound && ready ? 'anim-up' : 'hidden'}>
                <Section title={`2. ${t.audioTitle}`}>
                  <SegmentedControl
                    label={t.audioOrigin}
                    fullWidth
                    options={[
                      { value: 'file', label: t.fromFile },
                      { value: 'mic', label: t.fromMic },
                      { value: 'video', label: t.fromVideo, disabled: !videoFile },
                    ]}
                    value={origin}
                    onChange={changeOrigin}
                  />
                  {origin === 'file' && (
                    <FileUpload
                      accept="audio/*,video/*"
                      label={t.audioLabel}
                      hint={t.audioHint}
                      labels={removeLabel}
                      onChange={(chosen) => void useAudio(chosen[0] ?? null)}
                    />
                  )}
                  {origin === 'mic' && (
                    <Button
                      className="w-full"
                      icon={recorder.recording ? <Square size={16} /> : <Mic size={16} />}
                      color={recorder.recording ? 'red' : 'secondary'}
                      onClick={recorder.recording ? recorder.stop : recorder.start}
                    >
                      {recorder.recording ? t.stopRecording : audio ? t.recordAgain : t.record}
                    </Button>
                  )}
                  {audioError && (
                    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                      {translate(audioError)}
                    </p>
                  )}

                  {recorder.recording && (
                    <div className="flex flex-col gap-2">
                      <div
                        role="img"
                        aria-label={t.liveWave}
                        className="flex h-12 items-center justify-end gap-[3px] overflow-hidden rounded-xl bg-neutral-200 px-2 dark:bg-neutral-950"
                      >
                        {Array.from({ length: LIVE_BARS }, (_, index) => {
                          // Las barras nuevas entran por la derecha.
                          const level = recorder.levels[recorder.levels.length - LIVE_BARS + index] ?? 0
                          return (
                            <span
                              key={index}
                              className="min-w-0 flex-1 rounded-full bg-[var(--blossom-accent)]"
                              style={{ height: `${Math.max(8, Math.min(1, level * 1.8) * 85)}%` }}
                            />
                          )
                        })}
                      </div>
                      <p className="text-center text-sm tabular-nums text-neutral-500">
                        {clock(recorder.seconds)} / {clock(MAX_SECONDS)}
                      </p>
                    </div>
                  )}

                  {audio && !recorder.recording && (
                    <>
                      <p className="text-sm text-neutral-500">{t.audioLoaded(round(audio.duration))}</p>
                      <Trim
                        label={linked && animated ? t.videoPosition : t.audioPart}
                        describe={t.range}
                        peaks={peaks!}
                        duration={audio.duration}
                        start={start}
                        length={length}
                        maxLength={MAX_TOTAL}
                        resizable
                        playing={playing}
                        playLabel={playing ? t.stop : t.listen}
                        onPlay={play}
                        onChange={(nextStart, nextLength) => {
                          stopPlayback()
                          setStart(nextStart)
                          setTotal(nextLength)
                        }}
                      />
                      <p className="text-sm text-neutral-500">{t.trimHelp}</p>
                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">{t.maxPerSticker}</span>
                        <SegmentedControl
                          label={t.maxPerSticker}
                          fullWidth
                          options={[
                            { value: '5', label: '5 s' },
                            { value: '10', label: '10 s' },
                          ]}
                          value={String(partLength)}
                          onChange={(value) => setPartLength(Number(value))}
                        />
                        <p className="text-sm text-neutral-500">{t.splitHelp(count)}</p>
                      </div>
                    </>
                  )}
                </Section>
              </div>
            </div>

            <div
              {...lock}
              className={ready ? 'anim-up flex min-w-0 flex-col gap-5' : 'hidden'}
              style={{ animationDelay: '100ms' }}
            >
              <Section title={`${withSound ? 3 : 2}. ${t.settingsTitle}`}>
                <PreviewStage
                  t={t}
                  expanded={expanded}
                  onExpanded={setExpanded}
                  zoom={viewZoom}
                  onZoom={setViewZoom}
                  erasing={erasing}
                  onErasing={setErasing}
                  brush={brush}
                  onBrush={setBrush}
                  canUndo={style.erased.length > 0}
                  onUndo={() => setStyle({ ...style, erased: style.erased.slice(0, -1) })}
                >
                  <canvas
                    ref={canvas}
                    width={SIZE}
                    height={SIZE}
                    aria-label={t.preview}
                    onPointerDown={startDrag}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={() => (drag.current = null)}
                    // Con la goma, el cursor es un círculo del tamaño del pincel.
                    style={
                      erasing
                        ? { cursor: brushCursor(Math.min(128, (brush * (canvas.current?.offsetWidth ?? 256)) / SIZE)) }
                        : undefined
                    }
                    className={`checker touch-none block aspect-square w-full rounded-2xl ${visual ? '' : 'opacity-50'} ${
                      style.key === null ? 'cursor-move' : 'cursor-crosshair'
                    }`}
                  />
                </PreviewStage>
                {visual && animated && !linked && (
                  <>
                    <Trim
                      label={t.videoPosition}
                      describe={t.range}
                      peaks={videoPeaks}
                      duration={visual.duration}
                      start={videoStart}
                      length={withSound ? Math.min(length || partLength, visual.duration) : clipLength}
                      maxLength={MAX_ANIMATION}
                      resizable={!withSound}
                      onChange={(nextStart, nextLength) => {
                        setVideoStart(nextStart)
                        if (!withSound) setClip(nextLength)
                      }}
                    />
                    {!withSound && <p className="text-sm text-neutral-500">{t.maxAnimation}</p>}
                  </>
                )}
                <Controls
                  t={t}
                  style={style}
                  onChange={setStyle}
                  erasing={erasing}
                  onErasing={toggleErasing}
                  brush={brush}
                  onBrush={setBrush}
                  still={!animated && !withSound}
                  transparentHint={animated || withSound ? t.transparentVideo : t.transparentImage}
                />
              </Section>
            </div>
          </fieldset>

          <div
            className={ready ? 'contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5' : 'flex flex-col gap-5 lg:col-span-3'}
          >
            {error && (
              <div role="alert">
                <Alert color="red" showIcon>
                  {translate(error)}
                </Alert>
              </div>
            )}

            {/* En celular el botón acompaña al desplazarse. */}
            <div
              className={
                ready
                  ? 'anim-pop sticky bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-20 flex flex-col gap-2 lg:static'
                  : 'hidden'
              }
            >
              <Button
                className="w-full shadow-lg"
                icon={<Sparkles size={18} />}
                color="accent"
                size="lg"
                loading={busy}
                disabled={!visual || (withSound && (!audio || recorder.recording))}
                onClick={generate}
              >
                {t.generate(count)}
              </Button>
              {withSound && !audio && <p className="text-center text-sm text-neutral-500">{t.needAudio}</p>}
            </div>
            {busy && (
              <>
                <ProgressBar value={Math.round(progress)} color="accent" label={count > 1 ? `${t.generating} · ${t.readyOf(results.length, count)}` : t.generating} showValue />
                <Button className="w-full" color="red" icon={<X size={16} />} onClick={cancel}>
                  {t.cancel}
                </Button>
              </>
            )}

            <div className={ready ? 'anim-up order-last lg:order-none' : 'hidden'} style={{ animationDelay: '200ms' }}>
              <Section title={t.stepsTitle}>
                <Stepper orientation="vertical" numbered current={0} steps={t.steps[mode]} />
              </Section>
            </div>
          </div>

          {results.length > 0 && (
            <div ref={resultsBox} className="anim-up scroll-mt-24 lg:col-span-3">
              <Section title={busy && count > 1 ? t.readyOf(results.length, count) : t.ready(results.length)}>
                {files.length > 1 && (
                  <Button
                    className="w-full"
                    color="secondary"
                    icon={<FileArchive size={16} />}
                    onClick={() => void downloadZip().catch((reason) => setError(errorCode(reason)))}
                  >
                    {t.zip}
                  </Button>
                )}
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {results.map((result) => {
                    const [main] = result.files
                    return (
                      <li
                        key={main.url}
                                                className="anim-pop flex min-w-0 flex-col gap-2"
                      >
                        {main.kind === 'video' ? (
                          <video
                            src={main.url}
                            controls
                            playsInline
                            preload="metadata"
                            className="checker aspect-square w-full rounded-2xl"
                          />
                        ) : (
                          <img src={main.url} alt={result.name} className="checker aspect-square w-full rounded-2xl" />
                        )}
                        <p className="truncate text-center text-xs text-neutral-500">
                          {result.name}
                          {result.seconds > 0 && ` · ${round(result.seconds)} s`}
                        </p>
                        {result.files.map((file, index) => {
                          const Icon = icons[file.kind]
                          const label = file.name.split('.').pop()!.toUpperCase()
                          return (
                            <a
                              key={file.url}
                              href={file.url}
                              download={file.name}
                              aria-label={t.download(file.name)}
                              className={`${link} ${
                                index === 0
                                  ? 'bg-[var(--blossom-accent)] text-[var(--blossom-accent-contrast)]'
                                  : 'bg-neutral-200 dark:bg-neutral-800'
                              }`}
                            >
                              <Icon size={14} aria-hidden /> {label} · {formatSize(file.size)}
                            </a>
                          )
                        })}
                      </li>
                    )
                  })}
                </ul>
              </Section>
            </div>
          )}
        </main>
      </div>

      {/* El pie llega de borde a borde, redondeado solo arriba. */}
      <Reveal className="app-footer [&>footer>*]:mx-auto [&>footer>*]:w-full [&>footer>*]:max-w-[78rem] [&>footer]:rounded-b-none [&>footer]:rounded-t-[2rem] [&>footer]:border-x-0 [&>footer]:border-b-0 [&>footer]:px-6 [&>footer]:py-10">
        <Footer
          brand="StickIt"
          description={t.footer.description}
          columns={[
            { title: t.footer.create, links: [{ label: t.footer.newSticker, href: '#crear' }] },
            {
              title: t.footer.learn,
              links: [
                { label: t.howTo, href: '#como' },
                { label: t.footer.faq, href: '#preguntas' },
              ],
            },
          ]}
          labels={{ rights: t.notAffiliated }}
          social={
            <span className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <span>
                {t.madeWith}{' '}
                <a href="https://blossomui.vercel.app/" target="_blank" rel="noopener" className={footerLink}>
                  Blossom UI
                </a>
              </span>
              <a href="https://github.com/juanigarciadev/stickit" target="_blank" rel="noopener" className={footerLink}>
                {t.sourceCode}
              </a>
              <a href="/licencias.txt" target="_blank" rel="license noopener" className={footerLink}>
                {t.licenses}
              </a>
            </span>
          }
        />
      </Reveal>
    </div>
  )
}
