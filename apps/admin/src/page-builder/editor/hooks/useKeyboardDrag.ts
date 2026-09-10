import { useRef } from 'react'
import type { CollisionDetection, DragStartEvent, KeyboardCoordinateGetter } from '@dnd-kit/core'
import { keyboardDropPlans, stepKeyboardPlan } from '../canvas/keyboardDropPlan'
import type { DropPlan } from '../canvas/dropPlan'
import { findNode } from '../core/tree'
import { getComponent } from '../core/registry'
import { useEditorStore } from '../store/editorStore'

export const keyboardInstructions = {
  draggable: 'Press Space or Enter to start dragging. Down or Right selects the next legal insertion position in document order; Up or Left selects the previous position. Press Space or Enter to drop, or Escape to cancel.',
}

/** Keyboard targets are semantic slots, independent of stale mouse coordinates. */
export function useKeyboardDrag() {
  const active = useRef(false)
  const plan = useRef<DropPlan | null>(null)
  const start = (event: DragStartEvent) => {
    active.current = event.activatorEvent.type === 'keydown'
    plan.current = null
  }
  const reset = () => { active.current = false; plan.current = null }
  const coordinateGetter: KeyboardCoordinateGetter = (event, { active: id, currentCoordinates, context }) => {
    const forward = event.code === 'ArrowDown' || event.code === 'ArrowRight'
    const backward = event.code === 'ArrowUp' || event.code === 'ArrowLeft'
    if (!forward && !backward) return
    event.preventDefault()
    const root = useEditorStore.getState().page.root
    const raw = String(id)
    const isNew = raw.startsWith('new:')
    const type = isNew ? raw.slice(4) : findNode(root, raw)?.type ?? ''
    const visible = new Set(context.droppableContainers.getEnabled().map(c => String(c.id).replace(/^drop:/, '')))
    const plans = keyboardDropPlans(root, type, isNew ? null : raw).filter(p => visible.has(p.overId))
    plan.current = stepKeyboardPlan(plans, plan.current, forward ? 1 : -1)
    // A coordinate change lets dnd-kit emit its normal drag lifecycle events.
    return { x: currentCoordinates.x, y: currentCoordinates.y + (forward ? 1 : -1) }
  }
  const collision = (pointerCollision: CollisionDetection): CollisionDetection => args => {
    if (!active.current) return pointerCollision(args)
    const target = plan.current
    if (!target) return []
    const match = args.droppableContainers.find(c => String(c.id) === target.overId || String(c.id) === `drop:${target.overId}`)
    return match ? [{ id: match.id }] : []
  }
  const describe = () => {
    const target = plan.current
    if (!target) return 'Use arrow keys to choose a legal insertion position.'
    const parent = findNode(useEditorStore.getState().page.root, target.parentId)
    return `Position ${target.index + 1} in ${getComponent(parent?.type ?? '')?.label ?? 'container'} (${target.parentId}). Press Space or Enter to drop, Escape to cancel.`
  }
  return { active, plan, start, reset, coordinateGetter, collision, describe }
}
