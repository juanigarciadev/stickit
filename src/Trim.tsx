import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { IconButton } from '@blossomui/react/button'
import { Play, Square } from 'lucide-react'

const BARS = 56

/** Altura de cada barra (0 a 1) según el volumen del audio. */
export function getPeaks(audio: AudioBuffer): number[] {
  const data = audio.getChannelData(0)
  const size = Math.max(1, Math.floor(data.length / BARS))
  const peaks = Array.from({ length: BARS }, (_, bar) => {
    let peak = 0
    for (let i = bar * size; i < Math.min(data.length, (bar + 1) * size); i++) peak = Math.max(peak, Math.abs(data[i]))
    return peak
  })
  const highest = Math.max(...peaks) || 1
  return peaks.map((peak) => peak / highest)
}

const flat = Array.from({ length: BARS }, () => 0.2)

type Props = {
  label: string
  peaks?: number[]
  /** Duración de todo el material, en segundos. */
  duration: number
  start: number
  length: number
  maxLength?: number
  onChange: (start: number, length: number) => void
  /** Si se pasa, se puede estirar el borde derecho para cambiar la duración. */
  resizable?: boolean
  playing?: boolean
  onPlay?: () => void
  /** Texto del botón de play y descripción del tramo para lectores de pantalla. */
  playLabel?: string
  describe: (from: string, to: string) => string
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const round = (value: number) => Math.round(value * 10) / 10

export function Trim({
  label,
  peaks = flat,
  duration,
  start,
  length,
  maxLength = duration,
  onChange,
  resizable,
  playing,
  onPlay,
  playLabel = '',
  describe,
}: Props) {
  const drag = useRef<{ resize: boolean; grab: number } | null>(null)
  const shortest = Math.min(1, duration)

  const move = (next: number) => onChange(round(clamp(next, 0, Math.max(0, duration - length))), length)
  const stretch = (next: number) =>
    onChange(start, round(clamp(next, shortest, Math.min(maxLength, duration - start))))

  const timeAt = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    return clamp((event.clientX - box.left) / box.width, 0, 1) * duration
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const time = timeAt(event)
    const edge = box.left + ((start + length) / duration) * box.width
    const resize = !!resizable && Math.abs(event.clientX - edge) <= 14
    // Si se toca fuera del tramo, el tramo salta y queda centrado en el dedo.
    const inside = time >= start && time <= start + length
    drag.current = { resize, grab: inside ? time - start : length / 2 }
    event.currentTarget.setPointerCapture(event.pointerId)
    if (!resize && !inside) move(time - length / 2)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    if (drag.current.resize) stretch(timeAt(event) - start)
    else move(timeAt(event) - drag.current.grab)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.key === 'ArrowRight' ? 0.1 : event.key === 'ArrowLeft' ? -0.1 : 0
    if (step) {
      if (event.shiftKey && resizable) stretch(length + step)
      else move(start + step)
    } else if (event.key === 'Home') move(0)
    else if (event.key === 'End') move(duration)
    else return
    event.preventDefault()
  }

  const left = (start / duration) * 100
  const width = Math.min(100 - left, (length / duration) * 100)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-neutral-500">
          {start.toFixed(1)} s – {(start + length).toFixed(1)} s
        </span>
      </div>
      <div className="flex items-center gap-3">
        {onPlay && (
          <IconButton
            rounded
            color="accent"
            label={playLabel}
            icon={playing ? <Square size={16} /> : <Play size={16} />}
            onClick={onPlay}
          />
        )}
        <div
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={round(Math.max(0, duration - length))}
          aria-valuenow={start}
          aria-valuetext={describe(start.toFixed(1), (start + length).toFixed(1))}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onKeyDown={onKeyDown}
          className="relative h-12 min-w-0 flex-1 cursor-grab touch-none select-none overflow-hidden rounded-xl bg-neutral-200 outline-none focus-visible:ring-2 focus-visible:ring-[var(--blossom-accent)] active:cursor-grabbing dark:bg-neutral-950"
        >
          <div
            className="absolute inset-y-0 border-x-2 border-[var(--blossom-accent)] bg-[color-mix(in_srgb,var(--blossom-accent)_25%,transparent)]"
            style={{ left: `${left}%`, width: `${width}%` }}
          >
            {resizable && (
              <span className="absolute inset-y-3 -right-1 w-1.5 cursor-ew-resize rounded-full bg-[var(--blossom-accent)]" />
            )}
          </div>
          <div aria-hidden className="absolute inset-0 flex items-center justify-between px-1.5">
            {peaks.map((peak, index) => (
              <span
                key={index}
                className="w-[3px] rounded-full bg-neutral-500 dark:bg-neutral-600"
                style={{ height: `${Math.max(8, peak * 70)}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
