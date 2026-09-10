import type { Device, EditorNode, StyleValue } from './types'

/**
 * Every mutation goes through a Command. Nothing in the UI touches the node
 * tree directly — that is what makes undo/redo, collaboration and an audit
 * log tractable later.
 */
export type Command =
  | { type: 'UPDATE_PAGE_META'; patch: { name?: string } }
  | { type: 'ADD_NODE'; parentId: string; node: EditorNode; index?: number }
  | { type: 'DELETE_NODE'; nodeId: string }
  | { type: 'MOVE_NODE'; nodeId: string; parentId: string; index: number }
  | { type: 'UPDATE_PROPS'; nodeId: string; patch: Record<string, unknown> }
  | {
      type: 'UPDATE_STYLE'
      nodeId: string
      device: Device
      patch: Record<string, StyleValue | null>
    }
  | { type: 'DUPLICATE_NODE'; nodeId: string }
  | { type: 'SELECT_NODE'; nodeId: string | null }

export type CommandType = Command['type']

/**
 * Structural commands change the shape of the tree. They are never merged
 * into a neighbouring history entry, and they close any open transaction —
 * "type a title then delete the node" must be two undo steps.
 */
const STRUCTURAL: ReadonlySet<CommandType> = new Set<CommandType>([
  'ADD_NODE',
  'DELETE_NODE',
  'MOVE_NODE',
  'DUPLICATE_NODE',
])

export function isStructuralCommand(command: Command): boolean {
  return STRUCTURAL.has(command.type)
}

/**
 * Identity of a *continuous edit*. Two consecutive commands with an equal,
 * non-null merge key collapse into one history entry (see the store).
 *
 * Keyed by node, device and the exact property set, so typing into a heading
 * merges with itself but not with a following font-size drag on the same node.
 */
export function mergeKeyOf(command: Command): string | null {
  switch (command.type) {
    case 'UPDATE_PAGE_META':
      return `page-meta:${propertyKey(command.patch)}`
    case 'UPDATE_PROPS':
      return `props:${command.nodeId}:${propertyKey(command.patch)}`
    case 'UPDATE_STYLE':
      return `style:${command.nodeId}:${command.device}:${propertyKey(command.patch)}`
    default:
      return null
  }
}

function propertyKey(patch: Record<string, unknown>): string {
  return Object.keys(patch).sort().join(',')
}

/** Selection is view state, not document state — it must not enter history. */
const NON_HISTORY: ReadonlySet<CommandType> = new Set<CommandType>(['SELECT_NODE'])

export function isHistoryCommand(command: Command): boolean {
  return !NON_HISTORY.has(command.type)
}

/** Human-readable label, used by the history list and future toasts. */
export function describeCommand(command: Command): string {
  switch (command.type) {
    case 'ADD_NODE':
      return `Add ${command.node.type}`
    case 'DELETE_NODE':
      return 'Delete element'
    case 'MOVE_NODE':
      return 'Move element'
    case 'UPDATE_PAGE_META':
      return 'Edit page metadata'
    case 'UPDATE_PROPS':
      return 'Edit content'
    case 'UPDATE_STYLE':
      return 'Edit style'
    case 'DUPLICATE_NODE':
      return 'Duplicate element'
    case 'SELECT_NODE':
      return 'Select element'
  }
}
