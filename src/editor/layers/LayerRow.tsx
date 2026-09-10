import { Fragment } from 'react'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { getComponent } from '../core/registry'
import { ROOT_TYPE } from '../core/types'
import type { EditorNode } from '../core/types'
import type { DropPlan } from '../canvas/dropPlan'
import { useEditorStore } from '../store/editorStore'
import { getString } from '../core/props'
import { cn } from '../../utils/cn'

export interface LayerRowProps {
  node: EditorNode
  depth: number
  collapsed: ReadonlySet<string>
  onToggle: (nodeId: string) => void
  plan: DropPlan | null
  activeId: string | null
}

export function LayerRow({ node, depth, collapsed, onToggle, plan, activeId }: LayerRowProps) {
  const definition = getComponent(node.type)
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId)
  const hoveredNodeId = useEditorStore((state) => state.hoveredNodeId)
  const dispatch = useEditorStore((state) => state.dispatch)
  const setHoveredNode = useEditorStore((state) => state.setHoveredNode)

  const isRoot = node.type === ROOT_TYPE
  const children = node.children ?? []
  const isCollapsed = collapsed.has(node.id)
  const sortable = useSortable({ id: node.id, disabled: isRoot })

  if (!definition) return null

  const Icon = definition.icon
  const isSelected = selectedNodeId === node.id
  const isDropTarget = plan?.parentId === node.id && plan.position === 'inside'
  const indicatorIndex = plan && plan.parentId === node.id ? plan.index : -1

  return (
    <>
      <div
        ref={isRoot ? undefined : sortable.setNodeRef}
        {...(isRoot ? {} : sortable.attributes)}
        {...(isRoot ? {} : sortable.listeners)}
        onClick={() => dispatch({ type: 'SELECT_NODE', nodeId: node.id })}
        onMouseEnter={() => setHoveredNode(node.id)}
        onMouseLeave={() => setHoveredNode(null)}
        style={{ paddingLeft: `${6 + depth * 12}px` }}
        className={cn(
          'group flex h-7 cursor-pointer items-center gap-1 pr-1.5 text-xs',
          isSelected ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50',
          hoveredNodeId === node.id && !isSelected && 'bg-slate-50',
          activeId === node.id && 'opacity-40',
          isDropTarget && 'ring-1 ring-inset ring-brand-500',
        )}
      >
        {children.length > 0 ? (
          <button
            type="button"
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
            aria-expanded={!isCollapsed}
            onClick={(event) => {
              event.stopPropagation()
              onToggle(node.id)
            }}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600"
          >
            {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        ) : (
          <span className="h-4 w-4 shrink-0" />
        )}

        <Icon className={cn('h-3.5 w-3.5 shrink-0', isSelected ? 'text-brand-600' : 'text-slate-400')} />
        <span className="min-w-0 flex-1 truncate">{layerLabel(node, definition.label)}</span>

        {isRoot ? null : (
          <button
            type="button"
            aria-label={`Delete ${definition.label}`}
            onClick={(event) => {
              event.stopPropagation()
              dispatch({ type: 'DELETE_NODE', nodeId: node.id })
            }}
            className="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-500 group-hover:flex"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {isCollapsed
        ? null
        : children.map((child, index) => (
            <Fragment key={child.id}>
              {index === indicatorIndex ? <RowIndicator depth={depth + 1} /> : null}
              <LayerRow
                node={child}
                depth={depth + 1}
                collapsed={collapsed}
                onToggle={onToggle}
                plan={plan}
                activeId={activeId}
              />
            </Fragment>
          ))}
      {!isCollapsed && indicatorIndex >= children.length ? <RowIndicator depth={depth + 1} /> : null}
    </>
  )
}

function RowIndicator({ depth }: { depth: number }) {
  return (
    <div aria-hidden style={{ marginLeft: `${6 + depth * 12}px` }} className="-my-0.5 h-1 rounded-full bg-brand-500" />
  )
}

/** Prefer the node's own text so the tree reads like the page. */
function layerLabel(node: EditorNode, fallback: string): string {
  const text = getString(node.props, 'text').trim()
  if (text.length > 0) return text.length > 28 ? `${text.slice(0, 28)}…` : text
  return fallback
}
