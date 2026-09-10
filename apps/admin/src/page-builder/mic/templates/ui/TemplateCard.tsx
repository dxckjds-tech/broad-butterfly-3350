/**
 * One MIC industry template. Selecting it does not write the store; the
 * parent receives the catalog id and runs the template service.
 */
import type { MicTemplateMeta } from '../../services/templateService'

export function TemplateCard({
  template,
  onSelect,
}: {
  template: MicTemplateMeta
  onSelect: (id: string) => void
}) {
  return (
    <button
      type="button"
      data-testid="mic-template-card"
      data-template-id={template.id}
      onClick={() => onSelect(template.id)}
      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/50"
    >
      <span className="block text-[12px] font-semibold text-slate-800">{template.name}</span>
      <span className="mt-0.5 block text-[11px] text-slate-500">适合：{template.industry}</span>
      <span className="mt-1.5 block text-[10px] uppercase tracking-wide text-slate-400">结构</span>
      <ol className="m-0 mt-0.5 list-decimal space-y-0.5 pl-4 text-[11px] text-slate-600">
        {template.structure.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </button>
  )
}
