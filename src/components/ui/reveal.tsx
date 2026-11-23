import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react'

/** Progressive enhancement: SSR and unsupported clients keep all content readable. */
export function RevealGroup({ children, ...props }: ComponentPropsWithoutRef<'div'>) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const container = root.current
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    if (!container || preference.matches || typeof IntersectionObserver === 'undefined') return
    const targets = Array.from(
      container.querySelectorAll<HTMLElement>('[data-reveal="scroll"]'),
    ).filter((target) => target.closest('[data-reveal-group]') === container)
    let observer: IntersectionObserver | undefined
    const show = (target: HTMLElement) => {
      if (target.dataset.revealState !== 'pending') return
      target.dataset.revealState = 'shown'
      observer?.unobserve(target)
    }
    const restore = () => {
      observer?.disconnect()
      targets.forEach((target) => target.removeAttribute('data-reveal-state'))
    }
    const focus = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return
      const target = event.target.closest<HTMLElement>('[data-reveal="scroll"]')
      if (target && targets.includes(target)) show(target)
    }
    try {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) show(entry.target as HTMLElement)
          })
        },
        { rootMargin: '0px 0px -24px 0px', threshold: 0 },
      )
      targets.forEach((target) => {
        // Never hide content already visible, above the viewport, or containing focus.
        if (
          target.getBoundingClientRect().top < innerHeight ||
          target.contains(document.activeElement)
        )
          return
        target.dataset.revealState = 'pending'
        observer?.observe(target)
      })
    } catch {
      restore()
    }
    container.addEventListener('focusin', focus)
    preference.addEventListener('change', restore)
    return () => {
      restore()
      container.removeEventListener('focusin', focus)
      preference.removeEventListener('change', restore)
    }
  }, [])
  return (
    <div {...props} ref={root} data-reveal-group="">
      {children}
    </div>
  )
}
