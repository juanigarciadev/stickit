import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { IconButton } from '@blossomui/react/button'
import { Maximize2, Pause, Play, Volume1, Volume2, VolumeX, X } from 'lucide-react'
import type { Texts } from './i18n'

// En iPhone el volumen de un video no se puede cambiar desde la página: ahí solo queda silenciar.
const canSetVolume = (() => {
  const probe = document.createElement('video')
  probe.volume = 0.5
  return probe.volume === 0.5
})()

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
const fill = (ratio: number) => ({ '--fill': `${ratio * 100}%` }) as CSSProperties

const round =
  'flex shrink-0 items-center justify-center rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--blossom-accent)] active:scale-90'

type Props = {
  t: Texts
  src: string
  name: string
  video: boolean
  /** Con audio se muestran los controles de volumen. */
  sound: boolean
}

/**
 * Un resultado: reproductor propio para los videos y vista a pantalla completa.
 * Al agrandar no se vuelve a montar nada, así el video sigue donde estaba.
 */
export function ResultMedia({ t, src, name, video, sound }: Props) {
  const element = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [volumeOpen, setVolumeOpen] = useState(false)

  // El evento "timeupdate" llega pocas veces por segundo: para que la barra corra suave se lee en cada cuadro.
  useEffect(() => {
    if (!playing) return
    let request = requestAnimationFrame(function tick() {
      setTime(element.current?.currentTime ?? 0)
      request = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(request)
  }, [playing])

  useEffect(() => {
    if (element.current && canSetVolume) element.current.volume = volume
  }, [volume])

  useEffect(() => {
    if (!expanded) return
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setExpanded(false)
    window.addEventListener('keydown', escape)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', escape)
    }
  }, [expanded])

  const toggle = () => {
    const player = element.current
    if (!player) return
    if (!player.paused) return player.pause()
    // Suena uno solo a la vez.
    document.querySelectorAll<HTMLVideoElement>('video[data-result]').forEach((other) => other.pause())
    void player.play()
  }

  const silent = muted || volume === 0
  const toggleMute = () => {
    if (volume === 0) setVolume(1)
    setMuted(!silent)
  }
  const VolumeIcon = silent ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  return (
    <div
      role={expanded ? 'dialog' : undefined}
      aria-modal={expanded || undefined}
      aria-label={expanded ? name : undefined}
      className={
        expanded
          ? 'fullscreen-safe fixed inset-x-0 top-0 z-50 flex flex-col gap-3 bg-white dark:bg-neutral-950'
          : 'flex flex-col gap-2'
      }
    >
      {expanded && (
        <div className="preview-top flex items-center justify-between gap-3">
          <span className="truncate font-medium">{name}</span>
          <IconButton color="secondary" label={t.close} icon={<X size={18} />} onClick={() => setExpanded(false)} />
        </div>
      )}

      <div className={expanded ? 'preview-room flex min-h-0 flex-1 items-center justify-center' : ''}>
        <div
          className="group relative aspect-square w-full overflow-hidden rounded-2xl"
          style={expanded ? { width: 'min(100cqw, 100cqh)' } : undefined}
        >
          {video ? (
            <video
              ref={element}
              data-result
              src={src}
              loop
              playsInline
              muted={silent}
              preload="metadata"
              onClick={toggle}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
              className="checker h-full w-full cursor-pointer"
            />
          ) : (
            <img src={src} alt={name} className="checker h-full w-full" />
          )}

          {!expanded && (
            <button
              type="button"
              aria-label={t.openResult(name)}
              onClick={() => setExpanded(true)}
              className={`${round} absolute right-1.5 top-1.5 h-7 w-7 bg-black/45 text-white backdrop-blur-sm hover:bg-black/70`}
            >
              <Maximize2 size={13} aria-hidden />
            </button>
          )}

          {video && (
            <>
              {/* El único botón de reproducir: mientras suena se esconde y vuelve al pasar el mouse. */}
              <button
                type="button"
                aria-label={playing ? t.pause : t.playVideo}
                onClick={toggle}
                className={`${round} absolute inset-0 m-auto bg-black/45 text-white backdrop-blur-sm hover:bg-black/65 ${
                  expanded ? 'h-20 w-20' : 'h-12 w-12'
                } ${playing ? 'opacity-0 focus-visible:opacity-100 [@media(hover:hover)]:group-hover:opacity-100' : ''}`}
              >
                {playing ? (
                  <Pause size={expanded ? 32 : 18} fill="currentColor" aria-hidden />
                ) : (
                  <Play size={expanded ? 32 : 18} fill="currentColor" className="translate-x-0.5" aria-hidden />
                )}
              </button>

              <div
                className={`pointer-events-none absolute inset-x-0 bottom-0 flex flex-col bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white ${
                  expanded ? 'px-4 pb-2 pt-12' : 'px-2 pb-0.5 pt-8'
                }`}
              >
                <div className="flex h-7 items-center justify-between gap-2">
                  <span
                    className={`whitespace-nowrap font-medium tabular-nums ${expanded ? 'text-sm' : 'text-[11px]'} ${
                      volumeOpen && !expanded ? 'invisible' : ''
                    }`}
                  >
                    {clock(time)} / {clock(duration)}
                  </span>
                  {sound && (
                    <div
                      className={`pointer-events-auto flex items-center rounded-full ${volumeOpen ? 'bg-black/55 pl-2.5' : ''}`}
                      onPointerEnter={(event) => event.pointerType === 'mouse' && setVolumeOpen(true)}
                      onPointerLeave={(event) => event.pointerType === 'mouse' && setVolumeOpen(false)}
                      onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && setVolumeOpen(false)}
                    >
                      {canSetVolume && volumeOpen && (
                        <input
                          type="range"
                          aria-label={t.volume(name)}
                          min={0}
                          max={1}
                          step={0.05}
                          value={silent ? 0 : volume}
                          onChange={(event) => {
                            setVolume(Number(event.target.value))
                            setMuted(false)
                          }}
                          style={fill(silent ? 0 : volume)}
                          className={`media-range media-range-light ${expanded ? 'w-28' : 'w-16'}`}
                        />
                      )}
                      <button
                        type="button"
                        aria-label={silent ? t.unmute : t.mute}
                        // En pantallas táctiles el primer toque abre el volumen; el siguiente silencia.
                        onClick={() => (canSetVolume && !volumeOpen ? setVolumeOpen(true) : toggleMute())}
                        className={`${round} h-7 w-7 hover:bg-white/15`}
                      >
                        <VolumeIcon size={expanded ? 20 : 15} aria-hidden />
                      </button>
                    </div>
                  )}
                </div>
                <input
                  type="range"
                  aria-label={t.seek(name)}
                  aria-valuetext={clock(time)}
                  min={0}
                  max={duration || 1}
                  step={0.01}
                  value={time}
                  onChange={(event) => {
                    const next = Number(event.target.value)
                    if (element.current) element.current.currentTime = next
                    setTime(next)
                  }}
                  style={fill(duration ? time / duration : 0)}
                  className="media-range media-range-light pointer-events-auto w-full"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
