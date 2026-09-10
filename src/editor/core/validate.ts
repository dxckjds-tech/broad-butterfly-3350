import { MAX_NODE_COUNT, MAX_TREE_DEPTH } from './limits'
import { getComponent } from './registry'
import { canInsertNode } from './rules'
import { ROOT_TYPE, SCHEMA_VERSION } from './types'
import type { EditorNode, PageDocument } from './types'

export type IssueCode =
  /** Failed the Zod shape schema (wrong or missing field types). */
  | 'SHAPE'
  | 'DUPLICATE_ID'
  | 'EMPTY_ID'
  | 'ROOT_TYPE'
  | 'ROOT_MISSING'
  | 'UNKNOWN_TYPE'
  | 'ILLEGAL_CHILDREN'
  | 'DEPTH_EXCEEDED'
  | 'NODE_COUNT_EXCEEDED'
  | 'CYCLE'
  | 'VERSION_TOO_NEW'

export interface DocumentIssue {
  code: IssueCode
  /** Dotted path into the document, e.g. `root.children.0`. */
  path: string
  message: string
}

export interface ValidateOptions {
  /**
   * Override the type check. Defaults to the component registry, which
   * means validation is only meaningful once components are registered —
   * pass a predicate in tests that do not import the component barrel.
   */
  knownType?: (type: string) => boolean
  /** Nesting rule. Defaults to `rules.ts` — override only in unit tests. */
  canInsert?: (parentType: string, childType: string) => boolean
}

/**
 * Structural validation that Zod cannot express: tree-wide uniqueness,
 * registry membership, and the size/depth ceilings.
 *
 * Returns every issue found rather than throwing on the first, so an
 * import dialog can show a full report.
 */
export function validateDocument(
  page: PageDocument,
  options: ValidateOptions = {},
): DocumentIssue[] {
  const knownType = options.knownType ?? ((type: string) => getComponent(type) !== undefined)
  const canInsert = options.canInsert ?? canInsertNode
  const issues: DocumentIssue[] = []

  if (page.schemaVersion > SCHEMA_VERSION) {
    issues.push({
      code: 'VERSION_TOO_NEW',
      path: 'schemaVersion',
      message: `document is version ${page.schemaVersion}, this editor understands up to ${SCHEMA_VERSION}`,
    })
  }

  const root = page.root as EditorNode | undefined
  if (!root || typeof root.id !== 'string' || root.id.length === 0) {
    issues.push({ code: 'ROOT_MISSING', path: 'root', message: 'root node is missing an id' })
    return issues
  }
  if (root.type !== ROOT_TYPE) {
    issues.push({
      code: 'ROOT_TYPE',
      path: 'root.type',
      message: `root node must be of type "${ROOT_TYPE}", found "${root.type}"`,
    })
  }

  const seenIds = new Set<string>()
  const seenNodes = new WeakSet<object>()
  let count = 0

  const walk = (node: EditorNode, path: string, depth: number): void => {
    count += 1
    if (count === MAX_NODE_COUNT + 1) {
      issues.push({
        code: 'NODE_COUNT_EXCEEDED',
        path,
        message: `document exceeds ${MAX_NODE_COUNT} nodes`,
      })
    }
    if (count > MAX_NODE_COUNT) return

    if (seenNodes.has(node)) {
      issues.push({ code: 'CYCLE', path, message: 'node appears twice in the tree' })
      return
    }
    seenNodes.add(node)

    if (depth > MAX_TREE_DEPTH) {
      issues.push({
        code: 'DEPTH_EXCEEDED',
        path,
        message: `nesting deeper than ${MAX_TREE_DEPTH} levels`,
      })
      return
    }

    // Whitespace counts as empty: an id of "   " would key React lists and
    // localStorage lookups on something no user can see or type.
    if (typeof node.id !== 'string' || node.id.trim().length === 0) {
      issues.push({ code: 'EMPTY_ID', path: `${path}.id`, message: 'node id must be a non-empty string' })
    } else if (seenIds.has(node.id)) {
      issues.push({
        code: 'DUPLICATE_ID',
        path: `${path}.id`,
        message: `duplicate node id "${node.id}"`,
      })
    } else {
      seenIds.add(node.id)
    }

    if (!knownType(node.type)) {
      issues.push({
        code: 'UNKNOWN_TYPE',
        path: `${path}.type`,
        message: `unknown component type "${node.type}"`,
      })
    }

    const children = node.children ?? []
    if (children.length > 0) {
      const definition = getComponent(node.type)
      if (definition && !definition.acceptsChildren) {
        issues.push({
          code: 'ILLEGAL_CHILDREN',
          path: `${path}.children`,
          message: `"${node.type}" cannot hold children`,
        })
      }
      if (definition) {
        for (const [index, child] of children.entries()) {
          if (!canInsert(node.type, child.type)) {
            issues.push({
              code: 'ILLEGAL_CHILDREN',
              path: `${path}.children.${index}`,
              message: `"${child.type}" is not allowed inside "${node.type}"`,
            })
          }
        }
      }
    }

    for (const [index, child] of children.entries()) {
      walk(child, `${path}.children.${index}`, depth + 1)
    }
  }

  walk(root, 'root', 0)
  return issues
}

/**
 * Cheap pre-pass over untrusted input, run *before* Zod.
 *
 * Zod's recursive node schema would follow a cyclic `children` reference
 * forever, so shape guards have to come first. Only walks `children`
 * arrays; everything else is left to Zod.
 */
export function preflight(input: unknown): DocumentIssue | null {
  if (typeof input !== 'object' || input === null) return null
  const root = (input as { root?: unknown }).root
  if (typeof root !== 'object' || root === null) return null

  const seen = new WeakSet<object>()
  let count = 0
  const stack: Array<{ node: object; path: string; depth: number }> = [
    { node: root, path: 'root', depth: 0 },
  ]

  while (stack.length > 0) {
    const frame = stack.pop()
    if (!frame) break
    if (seen.has(frame.node)) {
      return {
        code: 'CYCLE',
        path: frame.path,
        message: 'document contains a circular node reference',
      }
    }
    seen.add(frame.node)

    count += 1
    if (count > MAX_NODE_COUNT) {
      return {
        code: 'NODE_COUNT_EXCEEDED',
        path: frame.path,
        message: `document exceeds ${MAX_NODE_COUNT} nodes`,
      }
    }
    if (frame.depth > MAX_TREE_DEPTH) {
      return {
        code: 'DEPTH_EXCEEDED',
        path: frame.path,
        message: `nesting deeper than ${MAX_TREE_DEPTH} levels`,
      }
    }

    const children = (frame.node as { children?: unknown }).children
    if (!Array.isArray(children)) continue
    for (const [index, child] of children.entries()) {
      if (typeof child === 'object' && child !== null) {
        stack.push({ node: child, path: `${frame.path}.children.${index}`, depth: frame.depth + 1 })
      }
    }
  }

  return null
}
