import type { PointerEvent } from 'react'
import { ArrowRight, Check, Download, Image, Music } from 'lucide-react'
import { ScrubbableSticker } from './ScrubbableSticker'
import type { Texts } from './i18n'

const files = [
  { icon: Download, name: 'sticker.mp4' },
  { icon: Music, name: 'sticker.m4a' },
  { icon: Image, name: 'sticker.png' },
]

// La tarjeta de ejemplo se inclina hacia donde está el mouse. En celular no, ni si se pidió menos movimiento.
const tilt = (event: PointerEvent<HTMLDivElement>) => {
  if (event.buttons || event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const box = event.currentTarget.getBoundingClientRect()
  const x = (event.clientX - box.left) / box.width - 0.5
  const y = (event.clientY - box.top) / box.height - 0.5
  const card = event.currentTarget.firstElementChild as HTMLElement
  card.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 14}deg)`
}

const flat = (event: PointerEvent<HTMLDivElement>) => {
  ;(event.currentTarget.firstElementChild as HTMLElement).style.transform = ''
}

export function ClosingCard({ t, onStart }: { t: Texts['landing']; onStart: () => void }) {
  return (
    <section className="relative grid items-center gap-10 overflow-hidden rounded-3xl border border-neutral-200 bg-white px-6 py-10 shadow-xl dark:border-neutral-800 dark:bg-neutral-900 md:px-12 md:py-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-400 opacity-20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-violet-400 opacity-20 blur-3xl" />

      <div className="relative flex min-w-0 flex-col items-start gap-5">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t.ctaTitle} <span className="text-[var(--blossom-accent)]">{t.ctaHighlight}</span>
        </h2>
        <p className="max-w-md text-neutral-600 dark:text-neutral-400">{t.ctaText}</p>
        <ul className="flex flex-col gap-2 text-sm">
          {t.ctaPoints.map((point) => (
            <li key={point} className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--blossom-accent)_18%,transparent)] text-[var(--blossom-accent)]">
                <Check size={13} aria-hidden />
              </span>
              {point}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onStart}
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--blossom-accent)] px-6 py-3 font-semibold text-[var(--blossom-accent-contrast)] shadow-lg outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--blossom-accent)] focus-visible:ring-offset-2 active:scale-[0.98] dark:focus-visible:ring-offset-neutral-900 sm:w-auto"
        >
          {t.start}
          <ArrowRight size={18} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* Ejemplo: la onda se puede tocar. */}
      <div className="relative min-w-0 [perspective:900px]" onPointerMove={tilt} onPointerLeave={flat}>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 shadow-2xl transition-transform duration-150 ease-out dark:border-neutral-700 dark:bg-neutral-950">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">{t.exampleTitle}</span>
          </div>

          <ScrubbableSticker label={t.scrub} pause={t.pause} play={t.play} />

          <ul className="mt-4 flex flex-col gap-2">
            {files.map(({ icon: Icon, name }) => (
              <li
                key={name}
                className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--blossom-accent)_18%,transparent)] text-[var(--blossom-accent)]">
                  <Icon size={14} />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
                <Check size={16} className="shrink-0 text-[var(--blossom-accent)]" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
