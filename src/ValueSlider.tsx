import { useRef, useState } from 'react'
import { Slider } from '@blossomui/react/slider'

type Props = {
  label: string
  /** Nombre accesible del botón que permite escribir el número. */
  editLabel: string
  unit: string
  min: number
  max: number
  step: number
  value: number
  hint?: string
  onChange: (value: number) => void
}

/** Slider de Blossom con el valor de la derecha editable: se toca, se escribe y Enter. */
export function ValueSlider({ editLabel, onChange, ...slider }: Props) {
  const { unit, min, max, value } = slider
  const [draft, setDraft] = useState<string | null>(null)
  const cancelled = useRef(false)

  const commit = () => {
    const typed = Number(draft?.replace(',', '.'))
    // Vacío o que no es un número deja el valor como estaba.
    if (!cancelled.current && draft?.trim() && Number.isFinite(typed)) {
      onChange(Math.round(Math.min(max, Math.max(min, typed))))
    }
    cancelled.current = false
    setDraft(null)
  }

  return (
    <div className="relative">
      <Slider {...slider} onChange={onChange} />
      {draft === null ? (
        <button
          type="button"
          aria-label={editLabel}
          onClick={() => setDraft(String(value))}
          className="absolute -top-1 right-0 rounded-lg px-2 py-0.5 text-sm tabular-nums text-neutral-500 outline-none hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-[var(--blossom-accent)] dark:hover:bg-neutral-800 dark:hover:text-white"
        >
          {value}
          {unit}
        </button>
      ) : (
        <input
          autoFocus
          aria-label={editLabel}
          inputMode={min < 0 ? 'text' : 'numeric'}
          value={draft}
          onFocus={(event) => event.target.select()}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Escape') cancelled.current = true
            if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur()
          }}
          className="absolute -top-1 right-0 w-20 rounded-lg border border-[var(--blossom-accent)] bg-white px-2 py-0.5 text-right text-base tabular-nums outline-none dark:bg-neutral-950 sm:text-sm"
        />
      )}
    </div>
  )
}
