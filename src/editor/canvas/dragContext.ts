import { createContext, useContext } from 'react'
import type { DropPlan } from './dropPlan'

/**
 * Transient drag state, kept in React context rather than the editor store:
 * it is view state that dies with the gesture and must never reach the
 * document or the history stack.
 */
export const DropPlanContext = createContext<DropPlan | null>(null)
export const ActiveDragContext = createContext<string | null>(null)

export function useDropPlan(): DropPlan | null {
  return useContext(DropPlanContext)
}

/** Id of the node currently being dragged, or null. */
export function useActiveDragId(): string | null {
  return useContext(ActiveDragContext)
}
