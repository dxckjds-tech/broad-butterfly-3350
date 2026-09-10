/**
 * One AI suggestion: title, target field, before/after, reason, risk, actions.
 */
import type { AISuggestion } from '../protocol/suggestion'
import { DiffViewer } from './DiffViewer'
import { RiskBadge } from './RiskBadge'
import { ApprovalActions } from './ApprovalActions'

export function SuggestionCard({
  suggestion,
  onApprove,
  onReject,
}: {
  suggestion: AISuggestion
  onApprove: (id: string) => void
  onReject: (id: string) => void
}) {
  const pending = suggestion.status === 'PENDING'
  return (
    <article
      data-testid="suggestion-card"
      data-suggestion-id={suggestion.id}
      data-status={suggestion.status}
      className="space-y-2 rounded-md border border-shell-border bg-white p-2.5"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="m-0 text-[12px] font-semibold text-slate-800">{suggestion.title}</h3>
        <RiskBadge risk={suggestion.risk} />
      </div>
      {suggestion.patches.length > 0 ? (
        suggestion.patches.map((entry) => (
          <div key={entry.id} data-patch-action={entry.action}>
            <p className="m-0 text-[11px] text-slate-500">
              字段：<span className="font-mono text-slate-700">{entry.target}</span>
            </p>
            <DiffViewer oldValue={entry.oldValue} newValue={entry.newValue} action={entry.action} />
          </div>
        ))
      ) : (
        <p className="m-0 text-[11px] text-slate-500">No patches on this suggestion.</p>
      )}
      <p className="m-0 text-[11px] leading-snug text-slate-600">
        原因：{suggestion.description}
      </p>
      {pending ? (
        <ApprovalActions
          onApprove={() => onApprove(suggestion.id)}
          onReject={() => onReject(suggestion.id)}
        />
      ) : (
        <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {suggestion.status}
        </p>
      )}
    </article>
  )
}
