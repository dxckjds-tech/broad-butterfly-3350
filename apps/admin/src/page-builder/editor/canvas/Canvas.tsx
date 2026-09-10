import { useRef } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useEditorStore } from '../store/editorStore'
import { NodeRenderer } from './NodeRenderer'
import { DROP_PREFIX } from './dropPlan'
import { SelectionOverlay } from './SelectionOverlay'
import { EmptyCanvas } from './EmptyCanvas'
import { DEVICE_FRAMES } from './deviceFrames'
import { CanvasBreadcrumb } from './CanvasBreadcrumb'
import { cn } from '../../utils/cn'

export function Canvas() {
  const page = useEditorStore((state) => state.page)
  const device = useEditorStore((state) => state.device)
  const preview = useEditorStore((state) => state.preview)
  const dispatch = useEditorStore((state) => state.dispatch)
  const frameRef = useRef<HTMLDivElement | null>(null)

  const frame = DEVICE_FRAMES[device]
  const isEmpty = (page.root.children ?? []).length === 0

  // Root-level drop zone so elements can land on an empty page.
  const { setNodeRef, isOver } = useDroppable({
    id: `${DROP_PREFIX}${page.root.id}`,
    disabled: preview,
    data: { kind: 'container', nodeId: page.root.id, depth: 0 },
  })

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-shell-bg">
      <div
        className="pb-scroll flex-1 overflow-auto px-6 py-6"
        onClick={() => !preview && dispatch({ type: 'SELECT_NODE', nodeId: null })}
      >
        <div
          ref={frameRef}
          className={cn(
            'relative mx-auto min-h-[560px] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.08),0_8px_24px_-12px_rgba(15,23,42,0.18)] transition-[width] duration-200',
            device === 'desktop' ? 'max-w-[1280px] rounded-lg' : 'rounded-xl',
          )}
          style={{ width: frame.width }}
        >
          {isEmpty ? (
            <div
              ref={setNodeRef}
              className={cn('rounded-lg', isOver && 'outline-2 outline-dashed outline-brand-500')}
            >
              <EmptyCanvas />
            </div>
          ) : (
            <NodeRenderer node={page.root} device={device} depth={0} />
          )}
          <SelectionOverlay frameRef={frameRef} />
        </div>
      </div>

      <div className="flex h-8 shrink-0 items-center justify-between border-t border-shell-border bg-white px-3 text-[11px] text-slate-500">
        <CanvasBreadcrumb />
        <span className="shrink-0 tabular-nums">
          {frame.label} · {frame.hint}
        </span>
      </div>
    </div>
  )
}
