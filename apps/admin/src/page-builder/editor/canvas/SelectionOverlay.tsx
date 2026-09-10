import type { ReactNode, RefObject } from 'react'
import { ArrowDown, ArrowUp, CornerLeftUp, Copy, GripVertical, Trash2 } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import { getComponent } from '../core/registry'
import { findNode, findParent, indexOfNode } from '../core/tree'
import { useEditorStore } from '../store/editorStore'
import { useNodeRect } from '../hooks/useNodeRect'
import { cn } from '../../utils/cn'

interface SelectionOverlayProps {
  frameRef: RefObject<HTMLElement | null>
}

export function SelectionOverlay({ frameRef }: SelectionOverlayProps) {
  const page = useEditorStore((state) => state.page)
  const device = useEditorStore((state) => state.device)
  const preview = useEditorStore((state) => state.preview)
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId)
  const hoveredNodeId = useEditorStore((state) => state.hoveredNodeId)
  const dispatch = useEditorStore((state) => state.dispatch)

  const revision = `${page.updatedAt}:${device}:${preview ? 1 : 0}`
  const selectedRect = useNodeRect(preview ? null : selectedNodeId, frameRef, revision)
  const hoveredRect = useNodeRect(
    preview || hoveredNodeId === selectedNodeId ? null : hoveredNodeId,
    frameRef,
    revision,
  )

  if (preview) return null

  const selectedNode = selectedNodeId ? findNode(page.root, selectedNodeId) : null
  const definition = selectedNode ? getComponent(selectedNode.type) : undefined
  const parent = selectedNodeId ? findParent(page.root, selectedNodeId) : null
  const index = selectedNodeId ? indexOfNode(page.root, selectedNodeId) : -1
  const siblingCount = parent?.children?.length ?? 0
  const isRoot = selectedNodeId === page.root.id

  /**
   * MOVE_NODE indices are pre-removal, so moving down by one slot means
   * targeting index + 2 (the reducer compensates for the extraction).
   */
  const moveUp = () => moveTo(index - 1)
  const moveDown = () => moveTo(index + 2)

  const moveTo = (targetIndex: number) => {
    if (!selectedNodeId || !parent || index < 0) return
    dispatch({ type: 'MOVE_NODE', nodeId: selectedNodeId, parentId: parent.id, index: targetIndex })
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {hoveredRect ? (
        <div
          className="absolute rounded-[2px] ring-1 ring-brand-300"
          style={{
            top: hoveredRect.top,
            left: hoveredRect.left,
            width: hoveredRect.width,
            height: hoveredRect.height,
          }}
        />
      ) : null}

      {selectedRect ? (
        <div
          className="absolute rounded-[2px] ring-2 ring-brand-600"
          style={{
            top: selectedRect.top,
            left: selectedRect.left,
            width: selectedRect.width,
            height: selectedRect.height,
          }}
        >
          <div
            className={cn(
              'pointer-events-auto absolute left-0 flex items-center gap-0.5 rounded-md bg-brand-600 px-1 py-0.5 text-[11px] font-medium text-white shadow-sm',
              selectedRect.top < 26 ? 'top-full mt-1' : '-top-6',
            )}
          >
            <span className="px-1">{definition?.label ?? selectedNode?.type ?? 'Node'}</span>
            {isRoot ? null : (
              <>
                <DragHandle nodeId={selectedNodeId ?? ''} />
                <OverlayButton
                  label="Select parent"
                  onClick={() => parent && dispatch({ type: 'SELECT_NODE', nodeId: parent.id })}
                >
                  <CornerLeftUp size={12} />
                </OverlayButton>
                <OverlayButton label="Move up" disabled={index <= 0} onClick={moveUp}>
                  <ArrowUp size={12} />
                </OverlayButton>
                <OverlayButton
                  label="Move down"
                  disabled={index < 0 || index >= siblingCount - 1}
                  onClick={moveDown}
                >
                  <ArrowDown size={12} />
                </OverlayButton>
                <OverlayButton
                  label="Duplicate"
                  onClick={() =>
                    selectedNodeId &&
                    dispatch({ type: 'DUPLICATE_NODE', nodeId: selectedNodeId })
                  }
                >
                  <Copy size={12} />
                </OverlayButton>
                <OverlayButton
                  label="Delete"
                  onClick={() =>
                    selectedNodeId && dispatch({ type: 'DELETE_NODE', nodeId: selectedNodeId })
                  }
                >
                  <Trash2 size={12} />
                </OverlayButton>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Drag an already-placed node into another container. */
function DragHandle({ nodeId }: { nodeId: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: nodeId,
    disabled: nodeId === '',
    data: { kind: 'move', nodeId },
  })
  return (
    <span
      ref={setNodeRef}
      title="Drag into another container"
      className={cn(
        'inline-flex h-5 w-4 cursor-grab items-center justify-center rounded hover:bg-white/25',
        isDragging && 'cursor-grabbing opacity-60',
      )}
      {...attributes}
      {...listeners}
    >
      <GripVertical size={12} />
    </span>
  )
}

interface OverlayButtonProps {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}

function OverlayButton({ label, onClick, disabled, children }: OverlayButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-5 w-5 items-center justify-center rounded transition-colors hover:bg-white/25 disabled:opacity-35 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}
