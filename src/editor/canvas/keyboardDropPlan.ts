import { canInsertNode } from '../core/rules'
import { findNode, findParent } from '../core/tree'
import type { EditorNode } from '../core/types'
import type { DropPlan } from './dropPlan'

/** Document-order insertion slots, shared by canvas and layers. */
export function keyboardDropPlans(root: EditorNode, activeType: string, activeId: string | null): DropPlan[] {
  if (activeId !== null) {
    const active = findNode(root, activeId)
    if (!active || active.id === root.id || active.type !== activeType) return []
  }
  const source = activeId ? findParent(root, activeId) : null
  const sourceIndex = source?.children?.findIndex(node => node.id === activeId) ?? -1
  const plans: DropPlan[] = []
  const visit = (parent: EditorNode) => {
    if (parent.id === activeId) return // Never enter the moving subtree.
    const children = parent.children ?? []
    for (let index = 0; index <= children.length; index += 1) {
      const noop = parent.id === source?.id && (index === sourceIndex || index === sourceIndex + 1)
      if (canInsertNode(parent.type, activeType) && !noop) {
        const child = children[index]
        const last = children[children.length - 1]
        plans.push({ parentId: parent.id, index,
          overId: child?.id ?? last?.id ?? parent.id,
          position: child ? 'before' : last ? 'after' : 'inside' })
      }
      const child = children[index]
      if (child) visit(child)
    }
  }
  visit(root)
  return plans
}

export function stepKeyboardPlan(plans: DropPlan[], current: DropPlan | null, direction: 1 | -1): DropPlan | null {
  if (plans.length === 0) return null
  const index = current ? plans.findIndex(p => p.parentId === current.parentId && p.index === current.index) : -1
  const next = index < 0 ? (direction === 1 ? 0 : plans.length - 1) : Math.max(0, Math.min(plans.length - 1, index + direction))
  return plans[next] ?? null
}
