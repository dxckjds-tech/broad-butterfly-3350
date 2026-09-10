import { createId } from './ids'
import type { EditorNode } from './types'

export function findNode(root: EditorNode, id: string): EditorNode | null {
  if (root.id === id) return root
  for (const child of root.children ?? []) {
    const hit = findNode(child, id)
    if (hit) return hit
  }
  return null
}

export function findParent(root: EditorNode, id: string): EditorNode | null {
  for (const child of root.children ?? []) {
    if (child.id === id) return root
    const hit = findParent(child, id)
    if (hit) return hit
  }
  return null
}

/** Depth of `id` below `root` (root itself = 0). -1 when not found. */
export function depthOf(root: EditorNode, id: string, depth = 0): number {
  if (root.id === id) return depth
  for (const child of root.children ?? []) {
    const hit = depthOf(child, id, depth + 1)
    if (hit >= 0) return hit
  }
  return -1
}

export function pathTo(root: EditorNode, id: string): EditorNode[] {
  if (root.id === id) return [root]
  for (const child of root.children ?? []) {
    const sub = pathTo(child, id)
    if (sub.length > 0) return [root, ...sub]
  }
  return []
}

export function isDescendant(root: EditorNode, ancestorId: string, nodeId: string): boolean {
  const ancestor = findNode(root, ancestorId)
  if (!ancestor) return false
  return findNode(ancestor, nodeId) !== null && ancestorId !== nodeId
}

/** Immutably replace one node, returning a new tree. */
export function updateNode(
  root: EditorNode,
  id: string,
  updater: (node: EditorNode) => EditorNode,
): EditorNode {
  if (root.id === id) return updater(root)
  if (!root.children) return root
  let changed = false
  const children = root.children.map((child) => {
    const next = updateNode(child, id, updater)
    if (next !== child) changed = true
    return next
  })
  return changed ? { ...root, children } : root
}

export interface RemoveResult {
  root: EditorNode
  removed: EditorNode | null
  parentId: string | null
  index: number
}

export function removeNode(root: EditorNode, id: string): RemoveResult {
  let removed: EditorNode | null = null
  let parentId: string | null = null
  let index = -1

  const walk = (node: EditorNode): EditorNode => {
    if (!node.children) return node
    const hitIndex = node.children.findIndex((child) => child.id === id)
    if (hitIndex >= 0) {
      removed = node.children[hitIndex] ?? null
      parentId = node.id
      index = hitIndex
      const children = node.children.filter((child) => child.id !== id)
      return { ...node, children }
    }
    let changed = false
    const children = node.children.map((child) => {
      const next = walk(child)
      if (next !== child) changed = true
      return next
    })
    return changed ? { ...node, children } : node
  }

  return { root: walk(root), removed, parentId, index }
}

export function insertNode(
  root: EditorNode,
  parentId: string,
  node: EditorNode,
  index?: number,
): EditorNode {
  return updateNode(root, parentId, (parent) => {
    const children = [...(parent.children ?? [])]
    const at = index === undefined ? children.length : Math.max(0, Math.min(index, children.length))
    children.splice(at, 0, node)
    return { ...parent, children }
  })
}

/** Deep copy with fresh ids, so a duplicate never shares identity. */
export function cloneWithNewIds(node: EditorNode): EditorNode {
  return {
    ...node,
    id: createId(node.type.slice(0, 3)),
    props: { ...node.props },
    styles: {
      ...(node.styles.desktop ? { desktop: { ...node.styles.desktop } } : {}),
      ...(node.styles.tablet ? { tablet: { ...node.styles.tablet } } : {}),
      ...(node.styles.mobile ? { mobile: { ...node.styles.mobile } } : {}),
    },
    ...(node.children ? { children: node.children.map(cloneWithNewIds) } : {}),
  }
}

export function indexOfNode(root: EditorNode, id: string): number {
  const parent = findParent(root, id)
  if (!parent || !parent.children) return -1
  return parent.children.findIndex((child) => child.id === id)
}

/** Every id in the subtree, depth-first. Used to assert id uniqueness. */
export function collectIds(root: EditorNode): string[] {
  const ids = [root.id]
  for (const child of root.children ?? []) ids.push(...collectIds(child))
  return ids
}
