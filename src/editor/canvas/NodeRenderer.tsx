import type { MouseEvent, ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable } from '@dnd-kit/sortable'
import { getComponent } from '../core/registry'
import type { NodeChrome } from '../core/registry'
import { resolveNodeStyles, toCssProperties } from '../core/styles'
import { getStringArray } from '../core/props'
import { ROOT_TYPE } from '../core/types'
import { useEditorStore } from '../store/editorStore'
import type { Device, EditorNode } from '../core/types'
import { DropIndicator } from './DropIndicator'
import { DROP_PREFIX } from './dropPlan'
import { useActiveDragId, useDropPlan } from './dragContext'
import { noShiftStrategy } from './sortStrategy'
import { cn } from '../../utils/cn'

export interface NodeRendererProps {
  node: EditorNode
  device: Device
  depth: number
}

export function NodeRenderer({ node, device, depth }: NodeRendererProps) {
  const definition = getComponent(node.type)
  const preview = useEditorStore((state) => state.preview)
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId)
  const hoveredNodeId = useEditorStore((state) => state.hoveredNodeId)
  const dispatch = useEditorStore((state) => state.dispatch)
  const setHoveredNode = useEditorStore((state) => state.setHoveredNode)
  const plan = useDropPlan()
  const activeDragId = useActiveDragId()

  const isRoot = node.type === ROOT_TYPE

  // The root is a drop target but never a draggable, so it keeps a plain
  // droppable at the lowest depth: it is the fallback when the pointer is
  // on page background rather than over any node.
  const rootDrop = useDroppable({
    id: `${DROP_PREFIX}${node.id}`,
    disabled: preview || !isRoot,
    data: { kind: 'root', depth: -1 },
  })

  // Every other node is sortable, which registers it as both a draggable
  // and a droppable under its own id.
  const sortable = useSortable({
    id: node.id,
    disabled: preview || isRoot,
    data: { kind: 'node', depth },
  })

  if (!definition) {
    return (
      <div
        data-node-id={node.id}
        className="rounded-md border border-dashed border-rose-300 bg-rose-50 p-3 text-xs text-rose-600"
      >
        Unknown component type “{node.type}”
      </div>
    )
  }

  // Per-device visibility, stored as prop so it survives publish.
  const hiddenOn = getStringArray(node.props, 'hiddenOn')
  if (hiddenOn.includes(device) && preview) return null

  const isSelected = selectedNodeId === node.id
  const isHovered = hoveredNodeId === node.id
  const isDragging = activeDragId === node.id
  const resolved = resolveNodeStyles(node, device)
  const style = toCssProperties(resolved)
  const horizontal = String(resolved['flexDirection'] ?? '').startsWith('row')
  const isDropTarget = plan?.parentId === node.id && plan.position === 'inside'

  const chrome: NodeChrome = {
    'data-node-id': node.id,
    className: cn(
      !preview && 'pb-node',
      !preview && hiddenOn.includes(device) && 'opacity-40',
      !preview && isDragging && 'opacity-40',
      isDropTarget && 'outline-2 outline-dashed outline-brand-500',
      !preview && isSelected && 'outline-2 outline-brand-600',
      !preview && !isSelected && isHovered && 'outline-1 outline-brand-300',
    ),
    style,
    onClick: (event: MouseEvent) => {
      if (preview) return
      event.stopPropagation()
      dispatch({ type: 'SELECT_NODE', nodeId: node.id })
    },
    onMouseEnter: (event: MouseEvent) => {
      if (preview) return
      event.stopPropagation()
      setHoveredNode(node.id)
    },
    onMouseLeave: (event: MouseEvent) => {
      if (preview) return
      event.stopPropagation()
      setHoveredNode(null)
    },
    ...(preview
      ? {}
      : isRoot
        ? { ref: rootDrop.setNodeRef }
        : { ref: sortable.setNodeRef, ...sortable.attributes, ...sortable.listeners }),
  }

  const Renderer = definition.renderer
  return (
    <Renderer node={node} device={device} chrome={chrome} preview={preview}>
      {definition.acceptsChildren
        ? renderChildren(node, device, depth, horizontal, preview ? null : plan)
        : undefined}
    </Renderer>
  )
}

/**
 * Children plus the insertion line. The indicator is a real element in the
 * child list at the planned index, which is why it always lands exactly
 * where the node will.
 */
function renderChildren(
  node: EditorNode,
  device: Device,
  depth: number,
  horizontal: boolean,
  plan: ReturnType<typeof useDropPlan>,
): ReactNode {
  const children = node.children ?? []
  const showIndicator = plan !== null && plan.parentId === node.id
  const index = showIndicator ? Math.max(0, Math.min(plan.index, children.length)) : -1

  const items: ReactNode[] = []
  children.forEach((child, position) => {
    if (position === index) {
      items.push(<DropIndicator key="drop-indicator" horizontal={horizontal} />)
    }
    items.push(<NodeRenderer key={child.id} node={child} device={device} depth={depth + 1} />)
  })
  if (index >= children.length) {
    items.push(<DropIndicator key="drop-indicator" horizontal={horizontal} />)
  }

  return (
    <SortableContext items={children.map((child) => child.id)} strategy={noShiftStrategy}>
      {items}
    </SortableContext>
  )
}
