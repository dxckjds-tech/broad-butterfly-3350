import { getComponent } from './registry'
import type { ComponentDefinition } from './registry'

/**
 * Every "can this node go there?" decision lives here.
 *
 * The canvas, the layers panel and the reducer all call `canInsertNode`.
 * No compatibility logic is allowed in JSX — a rule that exists in two
 * places will disagree with itself the first time one side is edited.
 *
 * Precedence, highest first:
 *   1. parent.canDrop(parent, child)     — escape hatch for real logic
 *   2. parent.allowedChildren            — explicit allow-list
 *   3. child.allowedParents              — explicit allow-list
 *   4. parent.acceptsChildren            — the coarse container flag
 */
export type InsertVerdict =
  | { ok: true }
  | { ok: false; reason: string }

export function explainInsert(parentType: string, childType: string): InsertVerdict {
  const parent = getComponent(parentType)
  if (!parent) return { ok: false, reason: `unknown parent type "${parentType}"` }

  const child = getComponent(childType)
  if (!child) return { ok: false, reason: `unknown component type "${childType}"` }

  if (!parent.acceptsChildren) {
    return { ok: false, reason: `${parent.label} cannot hold children` }
  }

  if (parent.canDrop && !parent.canDrop(parent, child)) {
    return { ok: false, reason: `${child.label} is not allowed inside ${parent.label}` }
  }

  if (parent.allowedChildren && !parent.allowedChildren.includes(childType)) {
    return {
      ok: false,
      reason: `${parent.label} only accepts ${describeList(parent.allowedChildren)}`,
    }
  }

  if (child.allowedParents && !child.allowedParents.includes(parentType)) {
    return {
      ok: false,
      reason: `${child.label} can only go inside ${describeList(child.allowedParents)}`,
    }
  }

  return { ok: true }
}

/** Hot path for drag hit-testing — same rules, boolean answer. */
export function canInsertNode(parentType: string, childType: string): boolean {
  return explainInsert(parentType, childType).ok
}

function describeList(types: readonly string[]): string {
  const labels = types.map((type) => getComponent(type)?.label ?? type)
  if (labels.length <= 1) return labels[0] ?? 'nothing'
  const last = labels[labels.length - 1]
  return `${labels.slice(0, -1).join(', ')} or ${last ?? ''}`
}

export type { ComponentDefinition }
