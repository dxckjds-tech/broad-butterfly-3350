import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { Point } from '../canvas/dropPlan'

/**
 * Live pointer position in client coordinates.
 *
 * dnd-kit hands pointer coordinates to collision detection but not to the
 * drag handlers, and before/after hit-testing needs them. A ref keeps this
 * off the render path — pointer moves must not re-render the canvas.
 */
export function usePointerPosition(): MutableRefObject<Point | null> {
  const pointer = useRef<Point | null>(null)

  useEffect(() => {
    const track = (event: PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY }
    }
    window.addEventListener('pointermove', track, { passive: true, capture: true })
    return () => window.removeEventListener('pointermove', track, true)
  }, [])

  return pointer
}
