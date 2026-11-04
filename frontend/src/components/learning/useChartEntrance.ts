import { useEffect, type RefObject } from 'react'

// Observe plots rather than cards so a long card starts animating when its chart is visible.
export default function useChartEntrance(rootRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root || !('IntersectionObserver' in window)) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const seen = new WeakSet<Element>()
    const visible = new WeakSet<Element>()
    const playing = new WeakMap<Element, Animation>()
    const animations = new Set<Animation>()
    const groups: Array<[string, string, 'vertical' | 'horizontal' | 'fade' | 'line']> = [
      ['.learning-time-bars', '.learning-time-bar', 'vertical'],
      ['.learning-volume-bars', '.learning-volume-stack', 'vertical'],
      ['.learning-review-bars', '.learning-review-track>span', 'vertical'],
      ['.learning-mastery-rows', '.learning-mastery-track>span', 'horizontal'],
      ['.learning-weak-ranking', '.learning-weak-track>span', 'horizontal'],
      ['.learning-relearning-days', '[role="img"]', 'horizontal'],
      ['.learning-relearning-total-bar', ':scope>span', 'horizontal'],
      ['.analytics-horizontal', '.analytics-track>i', 'horizontal'],
      ['.learning-calendar-grid', 'button', 'fade'],
      ['.analytics-growth-columns', 'svg path:not(.growth-area)', 'line'],
    ]
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.3) {
          visible.delete(entry.target)
          continue
        }
        if (visible.has(entry.target)) continue
        visible.add(entry.target)
        if (motion.matches) continue
        const config = groups.find(([selector]) => entry.target.matches(selector))
        if (!config) continue
        const [, selector, kind] = config
        entry.target.querySelectorAll<HTMLElement | SVGPathElement>(selector).forEach((element, index) => {
          playing.get(element)?.cancel()
          let frames: Keyframe[]
          if (kind === 'line' && element instanceof SVGPathElement) {
            const length = element.getTotalLength()
            frames = [{ strokeDasharray: `${length}`, strokeDashoffset: `${length}` }, { strokeDasharray: `${length}`, strokeDashoffset: '0' }]
          } else if (kind === 'fade') {
            frames = [{ opacity: 0 }, { opacity: 1 }]
          } else {
            const origin = kind === 'vertical' ? 'center bottom' : 'left center'
            frames = [{ transform: kind === 'vertical' ? 'scaleY(0)' : 'scaleX(0)', transformOrigin: origin }, { transform: 'scale(1)', transformOrigin: origin }]
          }
          const animation = element.animate(frames, { duration: kind === 'line' ? 1000 : 650, delay: Math.min(index * (kind === 'fade' ? 7 : 55), 550), easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' })
          animations.add(animation)
          playing.set(element, animation)
          animation.oncancel = () => animations.delete(animation)
          animation.onfinish = () => { animations.delete(animation); animation.cancel() }
        })
      }
    }, { threshold: [0, 0.3] })
    const discover = () => {
      for (const [selector] of groups) root.querySelectorAll(selector).forEach(element => {
        if (seen.has(element)) return
        seen.add(element)
        observer.observe(element)
      })
    }
    discover()
    const mutations = new MutationObserver(discover)
    mutations.observe(root, { childList: true, subtree: true })
    const stopMotion = () => { if (motion.matches) animations.forEach(animation => animation.cancel()) }
    motion.addEventListener('change', stopMotion)
    return () => {
      mutations.disconnect()
      observer.disconnect()
      animations.forEach(animation => animation.cancel())
      motion.removeEventListener('change', stopMotion)
    }
  }, [rootRef])
}
