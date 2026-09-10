/**
 * MIC Template Center. Lists Machinery / Electronic / Consumer.
 * Clicking a card calls `onSelect(id)` — this component does not dispatch.
 */
import { listMicTemplates } from '../../services/templateService'
import { TemplateCard } from './TemplateCard'

export function TemplateCenter({ onSelect }: { onSelect: (templateId: string) => void }) {
  const templates = listMicTemplates()
  return (
    <div data-testid="mic-template-center" className="space-y-2">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        MIC templates
      </p>
      <ul className="m-0 space-y-1.5 p-0">
        {templates.map((template) => (
          <li key={template.id}>
            <TemplateCard template={template} onSelect={onSelect} />
          </li>
        ))}
      </ul>
    </div>
  )
}
