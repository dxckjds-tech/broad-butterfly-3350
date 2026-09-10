import { ChevronRight } from 'lucide-react'
import { getComponent } from '../core/registry'
import { useEditorStore } from '../store/editorStore'
import { useSelectionPath } from '../hooks/useSelectedNode'

/** Ancestor trail for the selected node — the fastest way to reach a parent. */
export function CanvasBreadcrumb() {
  const dispatch = useEditorStore((state) => state.dispatch)
  const path = useSelectionPath()

  if (path.length === 0) {
    return <span className="truncate text-slate-400">No element selected</span>
  }

  return (
    <nav className="flex min-w-0 items-center gap-0.5 overflow-hidden">
      {path.map((node, position) => {
        const definition = getComponent(node.type)
        const last = position === path.length - 1
        return (
          <span key={node.id} className="flex shrink-0 items-center gap-0.5">
            {position > 0 ? <ChevronRight size={11} className="text-slate-300" /> : null}
            <button
              type="button"
              onClick={() => dispatch({ type: 'SELECT_NODE', nodeId: node.id })}
              className={
                last
                  ? 'rounded px-1 font-medium text-brand-600'
                  : 'rounded px-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }
            >
              {definition?.label ?? node.type}
            </button>
          </span>
        )
      })}
    </nav>
  )
}
