import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { CollisionDetection, DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core'
import { keyboardInstructions, useKeyboardDrag } from '../hooks/useKeyboardDrag'
import { Toolbar } from './Toolbar'
import { RecoveryBanner } from './RecoveryBanner'
import { LeftPanel } from './LeftPanel'
import { RightPanel } from './RightPanel'
import { Canvas } from '../canvas/Canvas'
import { ActiveDragContext, DropPlanContext } from '../canvas/dragContext'
import { computeDropPlan } from '../canvas/dropPlan'
import type { DropPlan } from '../canvas/dropPlan'
import { NEW_PREFIX } from './ComponentPalette'
import { createNode, getComponent } from '../core/registry'
import { resolveNodeStyles } from '../core/styles'
import { findNode } from '../core/tree'
import type { EditorNode } from '../core/types'
import { useEditorStore } from '../store/editorStore'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useAutosave } from '../hooks/useAutosave'
import { usePointerPosition } from '../hooks/usePointerPosition'

/**
 * Nested containers all register as droppables, so the plain pointer-within
 * collision would happily resolve to an ancestor. Pick the deepest match —
 * the page root sits at depth -1 and is therefore the last resort.
 */
const deepestPointerWithin: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  if (hits.length <= 1) return hits
  const depthOf = (id: string): number => {
    const container = args.droppableContainers.find((entry) => String(entry.id) === id)
    const depth = container?.data.current?.['depth']
    return typeof depth === 'number' ? depth : -1
  }
  return [...hits].sort((a, b) => depthOf(String(b.id)) - depthOf(String(a.id)))
}

export function EditorShell() {
  const dispatch = useEditorStore((state) => state.dispatch)
  const preview = useEditorStore((state) => state.preview)
  const device = useEditorStore((state) => state.device)
  const loadFromStorage = useEditorStore((state) => state.loadFromStorage)
  const notice = useEditorStore((state) => state.notice)
  const setNotice = useEditorStore((state) => state.setNotice)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [plan, setPlan] = useState<DropPlan | null>(null)
  // The drop needs the plan synchronously at drag end, before React commits.
  const planRef = useRef<DropPlan | null>(null)
  // Shared with the layers panel; the hook explains why this is a ref.
  const pointerRef = usePointerPosition()
  const keyboard = useKeyboardDrag()

  useKeyboardShortcuts()
  useAutosave()

  // Restore the last saved document on first mount.
  useEffect(() => {
    loadFromStorage()
  }, [loadFromStorage])

  // Notices are transient.
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 2600)
    return () => window.clearTimeout(timer)
  }, [notice, setNotice])

  const sensors = useSensors(
    // A small threshold keeps click-to-select working on nodes.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboard.coordinateGetter }),
  )

  const isHorizontal = useCallback(
    (parent: EditorNode) =>
      String(resolveNodeStyles(parent, device)['flexDirection'] ?? '').startsWith('row'),
    [device],
  )

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
    const rawActive = String(event.active.id)
    const isNew = rawActive.startsWith(NEW_PREFIX)
    const { page } = useEditorStore.getState()
    const activeType = isNew
      ? rawActive.slice(NEW_PREFIX.length)
      : (findNode(page.root, rawActive)?.type ?? '')
    if (keyboard.active.current) {
      planRef.current = keyboard.plan.current
      setPlan(keyboard.plan.current)
      return
    }
    if (!event.over || activeType === '') {
      setPlan(null)
      planRef.current = null
      return
    }

    const rect = event.over.rect
    const next = computeDropPlan({
      root: page.root,
      activeType,
      activeId: isNew ? null : rawActive,
      overId: String(event.over.id),
      overRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      pointer: pointerRef.current,
      isHorizontal,
    })

    planRef.current = next
    setPlan((current) => (samePlan(current, next) ? current : next))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const target = planRef.current
    const rawActive = String(event.active.id)
    reset()
    if (!target) return

    // Every mutation goes through a command — the UI never edits the tree.
    if (rawActive.startsWith(NEW_PREFIX)) {
      dispatch({
        type: 'ADD_NODE',
        parentId: target.parentId,
        node: createNode(rawActive.slice(NEW_PREFIX.length)),
        index: target.index,
      })
      return
    }
    dispatch({
      type: 'MOVE_NODE',
      nodeId: rawActive,
      parentId: target.parentId,
      index: target.index,
    })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={keyboard.collision(deepestPointerWithin)}
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
      <ActiveDragContext.Provider value={activeId}>
        <DropPlanContext.Provider value={plan}>
          <div data-editor-dragging={activeId !== null || undefined} className="flex h-full flex-col overflow-hidden">
            <Toolbar />
            {preview ? null : <RecoveryBanner />}
            <div className="flex min-h-0 flex-1">
              {preview ? null : <LeftPanel />}
              <Canvas />
              {preview ? null : <RightPanel />}
            </div>
          </div>
          <DragOverlay dropAnimation={null}>
            {activeId ? <DragChip activeId={activeId} /> : null}
          </DragOverlay>
        </DropPlanContext.Provider>
      </ActiveDragContext.Provider>
    </DndContext>
  )
}

/** Cursor-following label, so the dragged node is identifiable mid-flight. */
function DragChip({ activeId }: { activeId: string }) {
  const { page } = useEditorStore.getState()
  const type = activeId.startsWith(NEW_PREFIX)
    ? activeId.slice(NEW_PREFIX.length)
    : (findNode(page.root, activeId)?.type ?? '')
  const definition = getComponent(type)
  if (!definition) return null
  const Icon = definition.icon
  return (
    <div className="pointer-events-none flex items-center gap-1.5 rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white shadow-lg">
      <Icon className="h-3.5 w-3.5" />
      {definition.label}
    </div>
  )
}

function samePlan(a: DropPlan | null, b: DropPlan | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.parentId === b.parentId && a.index === b.index && a.position === b.position && a.overId === b.overId
}
