import { useDraggable } from '@dnd-kit/core'
import { acceptsChildren, createNode, listComponentsByCategory } from '../core/registry'
import type { ComponentCategory, ComponentDefinition } from '../core/registry'
import { findNode, findParent } from '../core/tree'
import type { EditorNode } from '../core/types'
import { useEditorStore } from '../store/editorStore'
import { cn } from '../../utils/cn'

export const NEW_PREFIX = 'new:'

const GROUPS: readonly { category: ComponentCategory; label: string }[] = [
  { category: 'layout', label: 'Layout' },
  { category: 'basic', label: 'Basic' },
  { category: 'media', label: 'Media' },
]

export function ComponentPalette() {
  return (
    <div className="pb-scroll flex-1 overflow-y-auto">
      {GROUPS.map((group) => {
        const items = listComponentsByCategory(group.category)
        if (items.length === 0) return null
        return (
          <div key={group.category} className="border-b border-shell-border px-3 py-2.5">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {group.label}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {items.map((definition) => (
                <PaletteItem key={definition.type} definition={definition} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PaletteItem({ definition }: { definition: ComponentDefinition }) {
  const dispatch = useEditorStore((state) => state.dispatch)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${NEW_PREFIX}${definition.type}`,
    data: { kind: 'new', componentType: definition.type },
  })

  /** Click-to-add: append into the selected container, else the page root. */
  const append = () => {
    const { page, selectedNodeId } = useEditorStore.getState()
    const parentId = resolveInsertParent(page.root, selectedNodeId)
    dispatch({ type: 'ADD_NODE', parentId, node: createNode(definition.type) })
  }

  const Icon = definition.icon
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={append}
      title={definition.description ?? definition.label}
      className={cn(
        'flex cursor-grab flex-col items-start gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-2 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/50',
        isDragging && 'opacity-40',
      )}
      {...attributes}
      {...listeners}
    >
      <Icon size={15} className="text-slate-500" />
      <span className="text-[11px] font-medium text-slate-700">{definition.label}</span>
    </button>
  )
}

/** Nearest container at or above the selection; falls back to the root. */
export function resolveInsertParent(
  root: EditorNode,
  selectedNodeId: string | null,
): string {
  if (!selectedNodeId) return root.id
  const selected = findNode(root, selectedNodeId)
  if (!selected) return root.id
  if (acceptsChildren(selected.type)) return selected.id
  const parent = findParent(root, selectedNodeId)
  return parent && acceptsChildren(parent.type) ? parent.id : root.id
}
