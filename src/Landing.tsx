import type { CSSProperties, ReactNode } from 'react'
import { Accordion } from '@blossomui/react/accordion'
import { Card } from '@blossomui/react/card'
import { ArrowRight, Eraser, Languages, Scissors, ShieldCheck, Sparkles, Volume2, Zap } from 'lucide-react'
import { Reveal } from './Reveal'
import { ClosingCard } from './ClosingCard'
import type { Texts } from './i18n'
import { heroGifs } from './heroGifs'

const featureIcons = [ShieldCheck, Volume2, Eraser, Scissors, Zap, Languages]

const stickers = [
  { emoji: '😹', place: 'left-[4%] top-[6%] h-36 w-36 text-7xl', tilt: '-8deg', wait: '0s', sound: true },
  { emoji: '🔥', place: 'right-[6%] top-0 h-28 w-28 text-5xl', tilt: '10deg', wait: '-1.5s', sound: false },
  { emoji: '🐸', place: 'left-[26%] top-[38%] h-44 w-44 text-8xl', tilt: '4deg', wait: '-3s', sound: true },
  { emoji: '💀', place: 'right-[2%] top-[52%] h-32 w-32 text-6xl', tilt: '-6deg', wait: '-4.5s', sound: true },
  { emoji: '✨', place: 'left-0 top-[68%] h-24 w-24 text-4xl', tilt: '12deg', wait: '-2.2s', sound: false },
]

const primary =
  'group flex items-center justify-center gap-2 rounded-xl bg-[var(--blossom-accent)] px-6 py-3 font-medium text-[var(--blossom-accent-contrast)] shadow-lg outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[var(--blossom-accent)] focus-visible:ring-offset-2 motion-reduce:transition-none dark:focus-visible:ring-offset-neutral-950'
const secondary =
  'flex items-center justify-center gap-2 rounded-xl border border-neutral-300 px-6 py-3 font-medium outline-none transition hover:border-[var(--blossom-accent)] focus-visible:ring-2 focus-visible:ring-[var(--blossom-accent)] dark:border-neutral-700'

const Heading = ({ children }: { children: ReactNode }) => (
  <Reveal>
    <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">{children}</h2>
  </Reveal>
)

/** Retraso escalonado de las entradas del hero. */
const after = (ms: number) => ({ '--delay': `${ms}ms` }) as CSSProperties

export function Landing({ t, onStart }: { t: Texts['landing']; onStart: (mode: 'silent' | 'sound') => void }) {
  return (
    <main className="flex flex-col gap-24 pb-10">
      <section className="relative grid items-center gap-12 pt-10 lg:grid-cols-2 lg:pt-20">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-10 left-1/4 h-72 w-72 rounded-full bg-emerald-400 opacity-20 blur-3xl" />
          <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-violet-400 opacity-20 blur-3xl" />
        </div>

        <div className="relative flex flex-col items-start gap-6">
          <span
            style={after(0)}
            className="anim-down flex items-center gap-2 rounded-full border border-[var(--blossom-accent)] bg-[color-mix(in_srgb,var(--blossom-accent)_10%,transparent)] px-4 py-2 text-sm font-medium text-[var(--blossom-accent)]"
          >
            <Sparkles size={14} aria-hidden /> {t.badge}
          </span>
          <h1 style={after(100)} className="anim-left text-5xl font-extrabold tracking-tight sm:text-6xl">
            {t.title}{' '}
            <span className="bg-gradient-to-r from-emerald-500 via-teal-400 to-violet-500 bg-clip-text text-transparent">
              {t.highlight}
            </span>
          </h1>
          <p style={after(220)} className="anim-left max-w-xl text-lg text-neutral-600 dark:text-neutral-300">
            {t.text}
          </p>
          <div style={after(340)} className="anim-up flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button type="button" className={primary} onClick={() => onStart('silent')}>
              {t.start}
              <ArrowRight size={18} aria-hidden className="transition group-hover:translate-x-1" />
            </button>
            <button type="button" className={secondary} onClick={() => onStart('sound')}>
              <Volume2 size={18} aria-hidden /> {t.startSound}
            </button>
          </div>
          <dl className="flex gap-8 pt-2">
            {t.stats.map(({ value, label }, index) => (
              <div key={label} style={after(480 + index * 100)} className="anim-up flex flex-col">
                <dt className="text-2xl font-bold">{value}</dt>
                <dd className="text-sm text-neutral-500">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex w-full flex-col items-center gap-3">
          <div aria-hidden className="relative mx-auto h-96 w-full max-w-md">
            {stickers.map(({ emoji, place, tilt, wait, sound }, index) => (
              <div key={emoji} style={after(350 + index * 180)} className={`anim-fly absolute ${place}`}>
                <div
                  className={`sticker-float relative flex h-full w-full items-center justify-center rounded-[28%] border-[6px] border-white bg-neutral-100 shadow-xl dark:bg-neutral-800`}
                  style={{ '--tilt': tilt, animationDelay: wait } as CSSProperties}
                >
                  {heroGifs[index] ? (
                    <img
                      src={heroGifs[index]}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full rounded-[22%] object-cover"
                    />
                  ) : (
                    emoji
                  )}
                  {sound && (
                    <span className="absolute -left-2 -top-2 flex h-9 items-center gap-0.5 rounded-full bg-neutral-900 px-2.5">
                      {[0, 1, 2, 3].map((bar) => (
                        <span
                          key={bar}
                          className="sound-bar h-4 w-0.5 rounded-full bg-white"
                          style={{ animationDelay: `${bar * 0.15}s` }}
                        />
                      ))}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-8">
        <Heading>{t.featuresTitle}</Heading>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.features.map(({ title, text }, index) => {
            const Icon = featureIcons[index]
            return (
              <Reveal key={title} delay={(index % 3) * 80} className="[&>*]:h-full">
                <Card title={title} description={text} icon={<Icon size={20} />} className="!w-full !max-w-none" />
              </Reveal>
            )
          })}
        </div>
      </section>

      <section id="como" className="flex scroll-mt-24 flex-col gap-8">
        <Heading>{t.stepsTitle}</Heading>
        <ol className="grid gap-4 md:grid-cols-3">
          {t.steps.map(({ title, text }, index) => (
            <li key={title}>
              <Reveal delay={index * 100} className="h-full">
                <div className="flex h-full flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
                  <span className="text-5xl font-extrabold text-[var(--blossom-accent)]">{index + 1}</span>
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="text-neutral-600 dark:text-neutral-400">{text}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      <section id="preguntas" className="mx-auto flex w-full max-w-2xl scroll-mt-24 flex-col gap-8">
        <Heading>{t.faqTitle}</Heading>
        <Reveal delay={100}>
          <Accordion
            variant="separated"
            items={t.faq.map(({ question, answer }, index) => ({
              id: String(index),
              title: question,
              content: answer,
            }))}
          />
        </Reveal>
      </section>

      <Reveal>
        <ClosingCard t={t} onStart={() => onStart('silent')} />
      </Reveal>
    </main>
  )
}
