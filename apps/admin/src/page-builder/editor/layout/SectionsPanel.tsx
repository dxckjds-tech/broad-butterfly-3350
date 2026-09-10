import { Plus } from 'lucide-react'
import { SECTION_PRESETS } from '../presets/sections'
import { useEditorStore } from '../store/editorStore'

/** Prebuilt subtrees appended to the page root. */
export function SectionsPanel() {
  const dispatch = useEditorStore((state) => state.dispatch)
  const rootId = useEditorStore((state) => state.page.root.id)

  return (
    <div className="pb-scroll flex-1 overflow-y-auto p-3">
      <p className="mb-2.5 text-[11px] leading-relaxed text-slate-500">
        Ready-made blocks. Each one is inserted as a normal node tree, so every element inside
        stays fully editable.
      </p>
      <ul className="space-y-1.5">
        {SECTION_PRESETS.map((preset) => (
          <li key={preset.id}>
            <button
              type="button"
              onClick={() =>
                dispatch({ type: 'ADD_NODE', parentId: rootId, node: preset.build() })
              }
              className="group flex w-full items-start gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/50"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-500 group-hover:bg-brand-100 group-hover:text-brand-600">
                <Plus size={12} />
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-medium text-slate-700">{preset.label}</span>
                <span className="block text-[11px] leading-snug text-slate-500">
                  {preset.description}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
