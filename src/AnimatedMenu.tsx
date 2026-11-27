import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'

const TOGGLE = 'button[aria-expanded]'
/** El panel que el Navbar de Blossom agrega debajo de la barra cuando el menú está abierto. */
const PANEL = 'header > div:nth-child(2)'

const slide = (panel: HTMLElement, opening: boolean) => {
  panel.style.overflow = 'hidden'
  const open = { height: `${panel.scrollHeight}px`, opacity: 1 }
  const closed = { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px' }
  const animation = panel.animate(opening ? [closed, open] : [open, closed], {
    duration: 250,
    easing: 'ease-out',
    // Al cerrar se queda plegado hasta que el Navbar lo quita.
    fill: opening ? 'none' : 'forwards',
  })
  return animation.finished.then(() => {
    if (opening) panel.style.overflow = ''
  })
}

/**
 * Anima el menú hamburguesa. El Navbar lo quita de la página en el momento al cerrarlo, así que
 * se intercepta el click, se pliega primero y recién después se le deja cerrar.
 */
export function AnimatedMenu({ children }: { children: ReactNode }) {
  const closing = useRef(false)
  const passThrough = useRef(false)
  const box = useRef<HTMLDivElement>(null)

  // Tocar afuera o desplazarse cierra el menú, pasando por el mismo plegado que el botón.
  useEffect(() => {
    const close = () => {
      const toggle = box.current?.querySelector<HTMLButtonElement>(TOGGLE)
      if (toggle?.getAttribute('aria-expanded') === 'true' && !closing.current) toggle.click()
    }
    const outside = (event: PointerEvent) => {
      if (!box.current?.querySelector('header')?.contains(event.target as Node)) close()
    }
    window.addEventListener('pointerdown', outside)
    window.addEventListener('scroll', close, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', outside)
      window.removeEventListener('scroll', close)
    }
  }, [])

  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (passThrough.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const wrapper = event.currentTarget
    const target = event.target as HTMLElement
    const toggle = wrapper.querySelector<HTMLButtonElement>(TOGGLE)
    if (!toggle) return
    const open = toggle.getAttribute('aria-expanded') === 'true'
    const onToggle = toggle.contains(target)

    if (!open) {
      if (onToggle) {
        requestAnimationFrame(() => {
          const panel = wrapper.querySelector<HTMLElement>(PANEL)
          if (panel) void slide(panel, true)
        })
      }
      return
    }

    const panel = wrapper.querySelector<HTMLElement>(PANEL)
    const link = panel?.contains(target) ? target.closest('a') : null
    if (!panel || (!onToggle && !link)) return
    event.preventDefault()
    event.stopPropagation()
    if (link) location.hash = link.hash
    if (closing.current) return
    closing.current = true
    void slide(panel, false).then(() => {
      passThrough.current = true
      toggle.click()
      passThrough.current = false
      closing.current = false
    })
  }

  // "contents" para que la caja no exista en el diseño: la barra sigue pegada arriba al desplazarse.
  return (
    <div ref={box} className="contents" onClickCapture={onClickCapture}>
      {children}
    </div>
  )
}
