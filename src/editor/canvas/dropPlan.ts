import { acceptsChildren } from '../core/registry'
import { canInsertNode } from '../core/rules'
import { findNode, findParent, isDescendant } from '../core/tree'
import type { EditorNode } from '../core/types'

/** Prefix marks the page-root fallback droppable. See `NodeRenderer`. */
export const DROP_PREFIX = 'drop:'

export type DropPosition = 'before' | 'after' | 'inside'

export interface DropPlan {
  /** Node that will receive the child. */
  parentId: string
  /** Index within `parent.children`, before any removal. */
  index: number
  /** Node the pointer is over — the indicator is drawn against it. */
  overId: string
  position: DropPosition
}

export interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export interface DropPlanInput {
  root: EditorNode
  /** Component type being dragged. */
  activeType: string
  /** Node id when reordering an existing node; null for a palette item. */
  activeId: string | null
  /** `over.id` from dnd-kit, still carrying `DROP_PREFIX` if it is the root zone. */
  overId: string
  overRect: Rect | null
  pointer: Point | null
  /** Row-direction containers measure before/after on X instead of Y. */
  isHorizontal?: (parent: EditorNode) => boolean
}

/**
 * Distance from a container's leading/trailing edge that means "beside me",
 * not "inside me". Without it a container's own body would swallow every
 * drop and you could never place a node next to a Section.
 */
const EDGE_ZONE = 12

/** Pointer in the first fraction of a container drops at index 0. */
const PREPEND_FRACTION = 0.4

/**
 * Resolve a hovered node plus a pointer position into a concrete insertion.
 *
 * `over` is already the *deepest* droppable under the pointer (see the
 * collision detection in `EditorShell`), so "the pointer is not over any
 * child" is implied whenever `over` is a container.
 *
 * Returns null when no legal insertion exists — the caller then shows no
 * indicator and the drop is a no-op.
 */
export function computeDropPlan(input: DropPlanInput): DropPlan | null {
  const { root, overId, activeId } = input
  const targetId = overId.startsWith(DROP_PREFIX) ? overId.slice(DROP_PREFIX.length) : overId
  if (activeId !== null) {
    const active = findNode(root, activeId)
    if (!active || active.id === root.id || active.type !== input.activeType) return null
    if (targetId === activeId || isDescendant(root, activeId, targetId)) return null
  }

  // Root fallback zone: the pointer is on page background.
  if (overId.startsWith(DROP_PREFIX)) {
    const containerId = overId.slice(DROP_PREFIX.length)
    const container = findNode(root, containerId)
    if (!container) return null
    return firstLegal(input, [insidePlan(container, input)])
  }

  const over = findNode(root, overId)
  if (!over) return null
  const parent = findParent(root, overId)
  const container = acceptsChildren(over.type)
  const horizontal = parent ? (input.isHorizontal?.(parent) ?? false) : false
  const onEdge = nearEdge(input.overRect, input.pointer, horizontal)

  const candidates: DropPlan[] = []
  const beside = parent ? besidePlan(parent, over, input, horizontal) : null

  if (container && !onEdge) {
    // Body of a container -> drop into it; fall back to beside it.
    candidates.push(insidePlan(over, input))
    if (beside) candidates.push(beside)
  } else {
    if (beside) candidates.push(beside)
    if (container) candidates.push(insidePlan(over, input))
  }

  // Keep the local inside/beside preference, then walk outward. Each
  // fallback anchors the indicator to the ancestor being placed beside.
  let ancestor = parent
  while (ancestor) {
    const grandparent = findParent(root, ancestor.id)
    if (!grandparent) break
    const candidate = besidePlan(grandparent, ancestor, input,
      input.isHorizontal?.(grandparent) ?? false)
    if (candidate) candidates.push(candidate)
    ancestor = grandparent
  }
  return firstLegal(input, candidates)
}

function insidePlan(container: EditorNode, input: DropPlanInput): DropPlan {
  const children = container.children ?? []
  const prepend = withinLeadingFraction(input.overRect, input.pointer)
  return {
    parentId: container.id,
    index: prepend ? 0 : children.length,
    overId: container.id,
    position: 'inside',
  }
}

function besidePlan(
  parent: EditorNode,
  over: EditorNode,
  input: DropPlanInput,
  horizontal: boolean,
): DropPlan | null {
  const siblings = parent.children ?? []
  const at = siblings.findIndex((child) => child.id === over.id)
  if (at < 0) return null
  const after = pastMidpoint(input.overRect, input.pointer, horizontal)
  return {
    parentId: parent.id,
    index: after ? at + 1 : at,
    overId: over.id,
    position: after ? 'after' : 'before',
  }
}

function firstLegal(input: DropPlanInput, candidates: DropPlan[]): DropPlan | null {
  for (const plan of candidates) {
    if (isLegal(input, plan)) return plan
  }
  return null
}

function isLegal(input: DropPlanInput, plan: DropPlan): boolean {
  const parent = findNode(input.root, plan.parentId)
  if (!parent) return false
  // Same rule table the reducer enforces — the UI only previews it.
  if (!canInsertNode(parent.type, input.activeType)) return false
  if (input.activeId === null) return true
  if (plan.parentId === input.activeId) return false
  return !isDescendant(input.root, input.activeId, plan.parentId)
}

function pastMidpoint(rect: Rect | null, pointer: Point | null, horizontal: boolean): boolean {
  if (!rect || !pointer) return false
  return horizontal
    ? pointer.x > rect.left + rect.width / 2
    : pointer.y > rect.top + rect.height / 2
}

function nearEdge(rect: Rect | null, pointer: Point | null, horizontal: boolean): boolean {
  if (!rect || !pointer) return false
  const zone = Math.min(EDGE_ZONE, (horizontal ? rect.width : rect.height) / 3)
  return horizontal
    ? pointer.x < rect.left + zone || pointer.x > rect.left + rect.width - zone
    : pointer.y < rect.top + zone || pointer.y > rect.top + rect.height - zone
}

function withinLeadingFraction(rect: Rect | null, pointer: Point | null): boolean {
  if (!rect || !pointer || rect.height === 0) return false
  return pointer.y < rect.top + rect.height * PREPEND_FRACTION
}
