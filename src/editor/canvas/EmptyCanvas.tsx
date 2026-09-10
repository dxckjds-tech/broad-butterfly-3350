import { MousePointerClick, Plus } from 'lucide-react'

/** Shown when the page root has no children. */
export function EmptyCanvas() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 px-8 py-16 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <Plus size={22} />
      </div>
      <h2 className="text-sm font-semibold text-slate-700">This page is empty</h2>
      <p className="max-w-xs text-xs leading-relaxed text-slate-500">
        Pick an element from the left panel — click to append it, or drag it onto a container.
        Prebuilt blocks live under the <span className="font-medium text-slate-600">Sections</span> tab.
      </p>
      <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <MousePointerClick size={13} />
        Click any element on the canvas to edit it
      </p>
    </div>
  )
}
