import { LayoutTemplate } from 'lucide-react'
import type { ReactNode } from 'react'
import { TEMPLATE_PRESETS } from '../presets/templates'
import type { PageDocument } from '../core/types'
import { useEditorStore } from '../store/editorStore'

/** Whole-page starters. Applying one discards the current document. */
export function TemplatesPanel({ micTemplates }: { micTemplates?: ReactNode }) {
  const replacePage = useEditorStore((state) => state.replacePage)
  const dirty = useEditorStore((state) => state.dirty)
  const setNotice = useEditorStore((state) => state.setNotice)

  const apply = (label: string, build: () => PageDocument) => {
    if (dirty && !window.confirm('Replace the current page? Unsaved changes will be lost.')) {
      return
    }
    replacePage(build())
    setNotice(`Applied template “${label}”`)
  }

  return (
    <div className="pb-scroll flex-1 overflow-y-auto p-3">
      {micTemplates ? (
        <div className="mb-4">
          {micTemplates}
        </div>
      ) : null}
      <p className="mb-2.5 text-[11px] leading-relaxed text-slate-500">
        Applying a template replaces the whole document and resets undo history.
      </p>
      <ul className="space-y-1.5">
        {TEMPLATE_PRESETS.map((preset) => (
          <li key={preset.id}>
            <button
              type="button"
              onClick={() => apply(preset.label, preset.build)}
              className="group flex w-full items-start gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/50"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-500 group-hover:bg-brand-100 group-hover:text-brand-600">
                <LayoutTemplate size={12} />
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
