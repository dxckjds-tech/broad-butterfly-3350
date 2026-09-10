import { keyboardInstructions, useKeyboardDrag } from '../hooks/useKeyboardDrag'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, pointerWithin, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { computeDropPlan } from '../canvas/dropPlan'
import type { DropPlan } from '../canvas/dropPlan'
import { noShiftStrategy } from '../canvas/sortStrategy'
import { collectIds, findNode, pathTo } from '../core/tree'
import { useEditorStore } from '../store/editorStore'
import { usePointerPosition } from '../hooks/usePointerPosition'
import { LayerRow } from './LayerRow'

/**
 * Structure panel. Selection, hover and reordering all go through the same
 * store commands the canvas uses — there is no second tree-mutation path.
 *
 * It runs its own DndContext: layer rows and canvas nodes would otherwise
 * share one id space, and a drag that starts in the panel has row geometry
 * (thin stacked rows), not page geometry.
 */
export function LayersPanel() {
  const page = useEditorStore((state) => state.page)
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId)
  const dispatch = useEditorStore((state) => state.dispatch)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set<string>())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [plan, setPlan] = useState<DropPlan | null>(null)
  const planRef = useRef<DropPlan | null>(null)
  const pointer = usePointerPosition()
  const keyboard = useKeyboardDrag()

  // Selecting a node on the canvas reveals it here. Keyed on the selection
  // only — re-running on every document change would fight the user, who may
  // have collapsed a branch while one of its descendants stayed selected.
  useEffect(() => {
    if (!selectedNodeId) return
    const ancestors = pathTo(useEditorStore.getState().page.root, selectedNodeId)
    if (ancestors.length === 0) return
    setCollapsed((current) => {
      if (!ancestors.some((node) => current.has(node.id))) return current
      const next = new Set(current)
      for (const node of ancestors) next.delete(node.id)
      return next
    })
  }, [selectedNodeId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboard.coordinateGetter }),
  )

  const toggle = useCallback((nodeId: string) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }, [])

  const reset = () => {
    keyboard.reset()
    setActiveId(null)
    setPlan(null)
    planRef.current = null
  }

  const handleDragStart = (event: DragStartEvent) => {
    keyboard.start(event)
    setActiveId(String(event.active.id))
  }

  const handleDragMove = (event: DragMoveEvent) => {
    const dragged = String(event.active.id)
    const node = findNode(page.root, dragged)
    if (keyboard.active.current) {
      planRef.current = keyboard.plan.current
      setPlan(keyboard.plan.current)
      return
    }
    if (!event.over || !node) {
      planRef.current = null
      setPlan(null)
      return
    }
    const rect = event.over.rect
    const next = computeDropPlan({
      root: page.root,
      activeType: node.type,
      activeId: dragged,
      overId: String(event.over.id),
      overRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      pointer: pointer.current,
    })
    planRef.current = next
    setPlan(next)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const target = planRef.current
    const dragged = String(event.active.id)
    reset()
    if (!target) return
    dispatch({ type: 'MOVE_NODE', nodeId: dragged, parentId: target.parentId, index: target.index })
  }

  // A flat SortableContext over every node: rows are one list visually,
  // and the plan decides the real parent from geometry.
  const items = collectIds(page.root).filter((id) => id !== page.root.id)

  return (
    <div data-editor-dragging={activeId !== null || undefined} className="pb-scroll flex-1 overflow-y-auto py-1.5">
      <DndContext
        sensors={sensors}
        collisionDetection={keyboard.collision(pointerWithin)}
        accessibility={{ screenReaderInstructions: keyboardInstructions,
          announcements: { onDragStart: () => 'Drag started. ' + keyboard.describe(),
            onDragMove: () => keyboard.active.current ? keyboard.describe() : undefined,
          onDragOver: () => keyboard.active.current ? keyboard.describe() : undefined,
            onDragEnd: () => 'Drag finished.', onDragCancel: () => 'Drag cancelled.' } }}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragOver={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={reset}
      >
        <SortableContext items={items} strategy={noShiftStrategy}>
          <LayerRow
            node={page.root}
            depth={0}
            collapsed={collapsed}
            onToggle={toggle}
            plan={plan}
            activeId={activeId}
          />
        </SortableContext>
      </DndContext>
    </div>
  )
}
