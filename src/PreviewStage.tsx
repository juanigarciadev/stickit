import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { Button, IconButton } from '@blossomui/react/button'
import { Check, Eraser, Hand, Maximize2, Minus, Move, Plus, Undo2 } from 'lucide-react'
import type { Texts } from './i18n'
import { ValueSlider } from './ValueSlider'

const MAX_ZOOM = 5
const round =
  'flex h-9 w-9 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--blossom-accent)] disabled:opacity-35'

type Props = {
  t: Texts
  expanded: boolean
  onExpanded: (expanded: boolean) => void
  /** Cuánto está ampliada la vista (no la imagen del sticker). */
  zoom: number
  onZoom: (zoom: number) => void
  erasing: boolean
  onErasing: (erasing: boolean) => void
  brush: number
  onBrush: (size: number) => void
  canUndo: boolean
  onUndo: () => void
  /** El canvas de la vista previa. */
  children: ReactNode
}

/**
 * La vista previa, que se puede abrir a pantalla completa para borrar con precisión.
 * El canvas no se vuelve a montar: solo cambian las clases de lo que lo envuelve.
 */
export function PreviewStage({
  t,
  expanded,
  onExpanded,
  zoom,
  onZoom,
  erasing,
  onErasing,
  brush,
  onBrush,
  canUndo,
  onUndo,
  children,
}: Props) {
  const [panning, setPanning] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const last = useRef<{ x: number; y: number } | null>(null)
  const viewport = useRef<HTMLDivElement>(null)

  // La vista nunca se corre más allá de sus bordes.
  const clamp = (x: number, y: number, scale: number) => {
    const limit = ((viewport.current?.clientWidth ?? 0) * (scale - 1)) / 2
    return { x: Math.max(-limit, Math.min(limit, x)), y: Math.max(-limit, Math.min(limit, y)) }
  }

  const changeZoom = (next: number) => {
    const value = Math.max(1, Math.min(MAX_ZOOM, next))
    onZoom(value)
    setOffset((current) => clamp(current.x, current.y, value))
  }

  const close = () => {
    setPanning(false)
    setOffset({ x: 0, y: 0 })
    onZoom(1)
    onErasing(false)
    onExpanded(false)
  }

  // Abierta, la página de atrás no se desplaza y Escape la cierra.
  useEffect(() => {
    if (!expanded) return
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && close()
    window.addEventListener('keydown', escape)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', escape)
    }
  }, [expanded])

  const pan = (event: PointerEvent) => {
    if (!last.current) return
    const dx = event.clientX - last.current.x
    const dy = event.clientY - last.current.y
    last.current = { x: event.clientX, y: event.clientY }
    setOffset((current) => clamp(current.x + dx, current.y + dy, zoom))
  }

  const tool = erasing ? 'erase' : panning ? 'pan' : 'move'
  const tools = [
    { value: 'erase', label: t.toolErase, icon: Eraser },
    { value: 'move', label: t.toolMove, icon: Move },
    { value: 'pan', label: t.toolPan, icon: Hand },
  ]

  return (
    <div
      role={expanded ? 'dialog' : undefined}
      aria-modal={expanded || undefined}
      aria-label={expanded ? t.preview : undefined}
      className={
        expanded
          ? 'fullscreen-safe fixed inset-x-0 top-0 z-50 flex flex-col gap-3 bg-white dark:bg-neutral-950'
          : 'relative mx-auto w-full max-w-64'
      }
    >
      {expanded && (
        <div className="preview-top flex items-center justify-between gap-3">
          <IconButton
            color="secondary"
            label={t.undo}
            icon={<Undo2 size={18} />}
            disabled={!canUndo}
            onClick={onUndo}
          />
          <Button color="accent" icon={<Check size={16} />} onClick={close}>
            {t.done}
          </Button>
        </div>
      )}

      <div className={expanded ? 'preview-room relative flex min-h-0 flex-1 items-center justify-center pb-14' : ''}>
        <div
          ref={viewport}
          className="relative aspect-square w-full overflow-hidden rounded-2xl"
          // El mayor cuadrado que entra en el lugar que dejan los botones.
          style={expanded ? { width: 'min(100cqw, 100cqh)' } : undefined}
        >
          <div style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}>{children}</div>
          {/* Con la mano, una capa encima recibe el arrastre para que no llegue al sticker. */}
          {expanded && panning && (
            <div
              className="absolute inset-0 cursor-grab touch-none"
              onPointerDown={(event) => {
                last.current = { x: event.clientX, y: event.clientY }
                event.currentTarget.setPointerCapture(event.pointerId)
              }}
              onPointerMove={pan}
              onPointerUp={() => (last.current = null)}
              onPointerCancel={() => (last.current = null)}
            />
          )}
        </div>
        {expanded && (
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-neutral-200 bg-white/90 p-1 shadow-lg backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/90">
            <button
              type="button"
              aria-label={t.zoomOut}
              disabled={zoom <= 1}
              onClick={() => changeZoom(zoom - 1)}
              className={round}
            >
              <Minus size={16} aria-hidden />
            </button>
            <span className="w-8 text-center text-sm tabular-nums">{zoom}×</span>
            <button
              type="button"
              aria-label={t.zoomIn}
              disabled={zoom >= MAX_ZOOM}
              onClick={() => changeZoom(zoom + 1)}
              className={round}
            >
              <Plus size={16} aria-hidden />
            </button>
          </div>
        )}
      </div>

      {!expanded && (
        <div className="absolute bottom-2 right-2">
          <IconButton
            color="secondary"
            size="sm"
            className="!bg-white/90 dark:!bg-neutral-900/90"
            label={t.expand}
            icon={<Maximize2 size={16} />}
            onClick={() => onExpanded(true)}
          />
        </div>
      )}

      {expanded && (
        <div className="preview-tools mx-auto flex w-full max-w-md flex-col gap-4">
          {/* Siempre ocupa su lugar, para que la imagen no salte al cambiar de herramienta. */}
          <div className={erasing ? '' : 'invisible'}>
            <ValueSlider
              label={t.brush}
              editLabel={t.editValue(t.brush)}
              unit=" px"
              min={8}
              max={160}
              step={4}
              value={brush}
              onChange={onBrush}
            />
          </div>
          <div
            role="radiogroup"
            aria-label={t.tool}
            className="grid grid-cols-3 gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800"
          >
            {tools.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={tool === value}
                onClick={() => {
                  onErasing(value === 'erase')
                  setPanning(value === 'pan')
                }}
                className="flex flex-col items-center gap-1 rounded-xl py-2 text-xs font-medium text-neutral-500 outline-none focus-visible:ring-2 focus-visible:ring-[var(--blossom-accent)] aria-checked:bg-[color-mix(in_srgb,var(--blossom-accent)_15%,transparent)] aria-checked:text-[var(--blossom-accent)]"
              >
                <Icon size={22} aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
