import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Pause, Play, Volume2 } from 'lucide-react'
import { closingGif, reducedMotion } from './heroGifs'

// Alturas fijas con forma de audio, en muchas líneas finas.
const WAVE = Array.from({ length: 64 }, (_, i) => 25 + Math.round(70 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23))))

const bars = (color: string) =>
  WAVE.map((height, index) => <span key={index} className={`w-0.5 rounded-full ${color}`} style={{ height: `${height}%` }} />)
const { url, frames, rows, columns, duration } = closingGif

/** El GIF y su onda: corre solo en bucle y se puede mover tocando o arrastrando. */
export function ScrubbableSticker({ label, pause, play }: { label: string; pause: string; play: string }) {
  const [time, setTime] = useState(0)
  const [visible, setVisible] = useState(false)
  // Con "reducir movimiento" arranca en pausa.
  const [paused, setPaused] = useState(reducedMotion)
  const dragging = useRef(false)
  const box = useRef<HTMLDivElement>(null)

  // Solo avanza (y solo baja la imagen) cuando la tarjeta está en pantalla.
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    observer.observe(box.current!)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || paused) return
    let last = performance.now()
    let request = requestAnimationFrame(function tick(now) {
      const passed = Math.max(0, (now - last) / 1000)
      last = now
      if (!dragging.current) setTime((value) => (value + passed) % duration)
      request = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(request)
  }, [visible, paused])

  const seek = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(0.999, Math.max(0, (event.clientX - bounds.left) / bounds.width))
    setTime(ratio * duration)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.key === 'ArrowRight' ? 0.1 : event.key === 'ArrowLeft' ? -0.1 : 0
    if (!step) return
    event.preventDefault()
    setTime((value) => (value + step + duration) % duration)
  }

  const frame = Math.min(frames - 1, Math.floor((time / duration) * frames))

  return (
    <div ref={box} className="mt-4 flex items-center gap-4">
      <div aria-hidden className="relative h-28 w-28 shrink-0 rounded-[28%] border-[5px] border-white shadow-lg">
        <div
          data-frame={frame}
          className="h-full w-full rounded-[22%] bg-neutral-800"
          style={{
            backgroundImage: visible || time > 0 ? `url(${url})` : undefined,
            backgroundSize: `${columns * 100}% ${rows * 100}%`,
            backgroundPosition: `${((frame % columns) / (columns - 1)) * 100}% ${
              rows > 1 ? (Math.floor(frame / columns) / (rows - 1)) * 100 : 0
            }%`,
          }}
        />
        <span className="absolute -left-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-white">
          <Volume2 size={15} />
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={Math.round(time * 10) / 10}
          onKeyDown={onKeyDown}
          onPointerDown={(event) => {
            dragging.current = true
            event.currentTarget.setPointerCapture(event.pointerId)
            seek(event)
          }}
          onPointerMove={(event) => dragging.current && seek(event)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
          className="flex h-14 cursor-pointer touch-none select-none items-center rounded-xl bg-neutral-200 px-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--blossom-accent)] dark:bg-neutral-900"
        >
          {/* Dos capas iguales: la pintada se recorta de forma continua, no de a una línea. */}
          <div aria-hidden className="relative h-full w-full">
            <div className="absolute inset-0 flex items-center justify-between">
              {bars('bg-neutral-400 dark:bg-neutral-700')}
            </div>
            <div
              className="absolute inset-0 flex items-center justify-between"
              style={{ clipPath: `inset(0 ${100 - (time / duration) * 100}% 0 0)` }}
            >
              {bars('bg-[var(--blossom-accent)]')}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label={paused ? play : pause}
            onClick={() => setPaused(!paused)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--blossom-accent)] text-[var(--blossom-accent-contrast)] outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-[var(--blossom-accent)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950"
          >
            {paused ? <Play size={15} aria-hidden /> : <Pause size={15} aria-hidden />}
          </button>
          <p aria-hidden className="text-xs tabular-nums text-neutral-500">
            {time.toFixed(1)} / {duration.toFixed(1)} s
          </p>
        </div>
      </div>
    </div>
  )
}
