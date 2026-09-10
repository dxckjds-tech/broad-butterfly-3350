import { useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'

export interface NodeRect {
  top: number
  left: number
  width: number
  height: number
}

/**
 * Measures a node's box relative to the device frame. The overlay lives
 * inside the same frame, so no scroll compensation is needed.
 */
export function useNodeRect(
  nodeId: string | null,
  frameRef: RefObject<HTMLElement | null>,
  // Re-measure whenever the document or device changes.
  revision: unknown,
): NodeRect | null {
  const [rect, setRect] = useState<NodeRect | null>(null)

  const measure = useCallback(() => {
    const frame = frameRef.current
    if (!frame || !nodeId) {
      setRect(null)
      return
    }
    const element = frame.querySelector<HTMLElement>(`[data-node-id="${nodeId}"]`)
    if (!element) {
      setRect(null)
      return
    }
    const box = element.getBoundingClientRect()
    const origin = frame.getBoundingClientRect()
    setRect({
      top: box.top - origin.top,
      left: box.left - origin.left,
      width: box.width,
      height: box.height,
    })
  }, [frameRef, nodeId])

  useEffect(() => {
    measure()
    // Fonts and images settle a frame later.
    const raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [measure, revision])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    const element = nodeId
      ? frame.querySelector<HTMLElement>(`[data-node-id="${nodeId}"]`)
      : null
    if (element) observer.observe(element)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [frameRef, measure, nodeId, revision])

  return rect
}
