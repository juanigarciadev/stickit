import { useRef, useState } from 'react'
import { Button } from '@blossomui/react/button'
import { ColorPicker } from '@blossomui/react/color-picker'
import { Input } from '@blossomui/react/forms'
import { SegmentedControl } from '@blossomui/react/segmented-control'
import { Check, Eraser, Pipette, RotateCcw, Trash2, Undo2, X } from 'lucide-react'
import type { Texts } from './i18n'
import { ValueSlider } from './ValueSlider'
import { SIZE, defaultStyle, type Background, type Style } from './media'

const EMOJIS = ['😂', '😍', '😎', '😭', '🔥', '💀', '❤️', '✨', '👍', '🎉', '👑', '🤡']
const COLORS = { white: '#ffffff', black: '#000000', yellow: '#facc15', red: '#ef4444', green: '#22c55e' }

function Swatches({
  label,
  names,
  value,
  onChange,
}: {
  label: string
  names: Texts['colors']
  value: string
  onChange: (color: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div role="group" aria-label={label} className="flex gap-3">
        {(Object.keys(COLORS) as (keyof typeof COLORS)[]).map((name) => (
          <button
            key={name}
            type="button"
            aria-label={names[name]}
            aria-pressed={value === COLORS[name]}
            onClick={() => onChange(COLORS[name])}
            className="h-9 w-9 rounded-full border border-neutral-400 outline-none ring-[var(--blossom-accent)] ring-offset-2 focus-visible:ring-2 aria-pressed:ring-2 dark:ring-offset-neutral-900"
            style={{ background: COLORS[name] }}
          />
        ))}
      </div>
    </div>
  )
}

type Props = {
  t: Texts
  style: Style
  onChange: (style: Style) => void
  transparentHint: string
  erasing: boolean
  onErasing: (erasing: boolean) => void
  brush: number
  onBrush: (size: number) => void
  /** Imagen fija sin audio: se puede pasar a transparente sin cambiar de formato de video. */
  still: boolean
}

/** Los ajustes del sticker, repartidos en tres pestañas. */
export function Controls({ t, style, onChange, transparentHint, erasing, onErasing, brush, onBrush, still }: Props) {
  const [tab, setTab] = useState<'image' | 'background' | 'text'>('image')
  // Para volver al fondo que había antes de quitar un color.
  const previousBackground = useRef<Background>('black')
  const set = (change: Partial<Style>) => onChange({ ...style, ...change })

  const toggleKey = () => {
    if (style.key === null) {
      previousBackground.current = style.background
      set({ key: '#00ff00', background: 'none' })
    } else set({ key: null, background: previousBackground.current })
  }

  const toggleEraser = () => {
    // Sobre un fondo de color, lo borrado se vería de ese color y parecería que pinta.
    if (!erasing && still && !style.erased.length) set({ background: 'none' })
    onErasing(!erasing)
  }

  return (
    <>
      <p className="text-center text-sm text-neutral-500">{t.dragHelp}</p>
      <SegmentedControl
        label={t.settingsTitle}
        fullWidth
        variant="filled"
        options={(['image', 'background', 'text'] as const).map((value) => ({ value, label: t.tabs[value] }))}
        value={tab}
        onChange={(value) => {
          onErasing(false)
          setTab(value as typeof tab)
        }}
      />

      {tab === 'image' && (
        <div className="anim-up flex flex-col gap-4">
          <SegmentedControl
            label={t.framing}
            fullWidth
            options={[
              { value: 'cover', label: t.cover },
              { value: 'contain', label: t.contain },
            ]}
            value={style.fit}
            onChange={(fit) => set({ fit: fit as Style['fit'] })}
          />
          <ValueSlider
            label={t.zoom}
            editLabel={t.editValue(t.zoom)}
            unit=" %"
            min={30}
            max={400}
            step={5}
            value={Math.round(style.zoom * 100)}
            onChange={(zoom) => set({ zoom: zoom / 100 })}
          />
          <ValueSlider
            label={t.rotate}
            editLabel={t.editValue(t.rotate)}
            unit="°"
            min={-180}
            max={180}
            step={1}
            value={style.rotate}
            onChange={(rotate) => set({ rotate })}
          />
          <Button
            className="w-full"
            color="secondary"
            icon={<RotateCcw size={16} />}
            onClick={() => set({ zoom: defaultStyle.zoom, x: 0, y: 0, rotate: 0 })}
          >
            {t.reset}
          </Button>
        </div>
      )}

      {tab === 'background' && (
        <div className="anim-up flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <SegmentedControl
              label={t.background}
              fullWidth
              options={[
                { value: 'white', label: t.white },
                { value: 'black', label: t.black },
                { value: 'none', label: t.none },
              ]}
              value={style.background}
              onChange={(background) => set({ background: background as Background })}
            />
            {style.background === 'none' && <p className="text-sm text-neutral-500">{transparentHint}</p>}
          </div>
          <Button
            className="w-full"
            color={erasing ? 'accent' : 'secondary'}
            icon={erasing ? <Check size={16} /> : <Eraser size={16} />}
            aria-pressed={erasing}
            onClick={toggleEraser}
          >
            {erasing ? t.eraserDone : t.eraser}
          </Button>
          {erasing && (
            <>
              <p className="text-sm text-neutral-500">{t.eraserHelp}</p>
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
            </>
          )}
          {style.erased.length > 0 && (
            <div className="flex gap-2">
              <Button
                className="flex-1"
                color="secondary"
                icon={<Undo2 size={16} />}
                onClick={() => set({ erased: style.erased.slice(0, -1) })}
              >
                {t.undo}
              </Button>
              <Button
                className="flex-1"
                color="secondary"
                icon={<Trash2 size={16} />}
                onClick={() => set({ erased: [] })}
              >
                {t.restore}
              </Button>
            </div>
          )}
          <Button
            className="w-full"
            color="secondary"
            icon={style.key === null ? <Pipette size={16} /> : <X size={16} />}
            onClick={toggleKey}
          >
            {style.key === null ? t.removeColor : t.keepColors}
          </Button>
          {style.key !== null && (
            <>
              <ColorPicker
                label={t.colorToRemove}
                hint={t.colorHint}
                value={style.key}
                onChange={(key) => set({ key })}
                labels={t.colorPicker}
              />
              <ValueSlider
                label={t.tolerance}
                editLabel={t.editValue(t.tolerance)}
                unit=" %"
                min={0}
                max={80}
                step={1}
                value={style.tolerance}
                onChange={(tolerance) => set({ tolerance })}
              />
            </>
          )}
          <ValueSlider
            label={t.outline}
            editLabel={t.editValue(t.outline)}
            unit=" px"
            min={0}
            max={24}
            step={2}
            value={style.outline}
            onChange={(outline) => set({ outline })}
            hint={t.outlineHelp}
          />
          {style.outline > 0 && (
            <Swatches
              label={t.outlineColor}
              names={t.colors}
              value={style.outlineColor}
              onChange={(outlineColor) => set({ outlineColor })}
            />
          )}
        </div>
      )}

      {tab === 'text' && (
        <div className="anim-up flex flex-col gap-4">
          <Input
            label={t.text}
            maxLength={30}
            value={style.text}
            onChange={(event) => set({ text: event.target.value })}
          />
          <Swatches
            label={t.textColor}
            names={t.colors}
            value={style.textColor}
            onChange={(textColor) => set({ textColor })}
          />
          <ValueSlider
            label={t.textSize}
            editLabel={t.editValue(t.textSize)}
            unit=" px"
            min={32}
            max={110}
            step={2}
            value={style.textSize}
            onChange={(textSize) => set({ textSize })}
          />
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t.emojis}</span>
            <div className="grid grid-cols-6 gap-2">
              {EMOJIS.map((char) => (
                <button
                  key={char}
                  type="button"
                  aria-label={t.addEmoji(char)}
                  // Cada uno nuevo cae un poco corrido, para que no tape al anterior.
                  onClick={() => {
                    const shift = ((style.emojis.length % 5) - 2) * 60
                    set({ emojis: [...style.emojis, { char, x: SIZE / 2 + shift, y: SIZE / 2 + shift / 2 }] })
                  }}
                  className="rounded-xl bg-neutral-100 py-1.5 text-xl outline-none transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-[var(--blossom-accent)] dark:bg-neutral-800"
                >
                  {char}
                </button>
              ))}
            </div>
            {style.emojis.length > 0 && (
              <Button
                className="w-full"
                color="secondary"
                icon={<Trash2 size={16} />}
                onClick={() => set({ emojis: [] })}
              >
                {t.clearEmojis}
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
