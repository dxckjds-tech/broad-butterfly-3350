/**
 * AI suggestion list. Data is passed in as `AISuggestion[]` — this panel
 * never calls an AI API and never writes MIC schema itself.
 */
import type { AISuggestion } from '../protocol/suggestion'
import { SuggestionCard } from './SuggestionCard'

export interface SuggestionPanelProps {
  suggestions: AISuggestion[]
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onRunAgents?: () => void
  agentBusy?: boolean
}

export function SuggestionPanel({
  suggestions,
  onApprove,
  onReject,
  onRunAgents,
  agentBusy = false,
}: SuggestionPanelProps) {
  return (
    <div className="pb-scroll flex-1 overflow-y-auto p-3" data-testid="suggestion-panel">
      <p className="mb-2.5 text-[11px] leading-relaxed text-slate-500">
        AI 只能提出 Patch。接受后才会写入 MIC 页面并刷新画布。
      </p>
      {onRunAgents ? (
        <button
          type="button"
          data-testid="run-ai-agents"
          disabled={agentBusy}
          onClick={onRunAgents}
          className="mb-2.5 w-full rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-[11px] font-medium text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {agentBusy ? 'Agents 运行中…' : '运行 AI Agents'}
        </button>
      ) : null}
      {suggestions.length === 0 ? (
        <p className="m-0 text-[12px] text-slate-500">暂无建议。从模板中心应用一个 MIC 模板后会出现预览建议。</p>
      ) : (
        <ul className="m-0 space-y-2 p-0">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id}>
              <SuggestionCard suggestion={suggestion} onApprove={onApprove} onReject={onReject} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
