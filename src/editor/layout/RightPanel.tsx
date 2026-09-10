import { useEffect, useState } from 'react'
import { Inspector } from '../inspector/Inspector'
import { Tabs } from '../ui/Tabs'
import type { TabItem } from '../ui/Tabs'
import type { AISuggestion } from '../../ai/protocol/suggestion'
import { SuggestionPanel } from '../../ai/suggestion-ui/SuggestionPanel'

type RightTab = 'inspector' | 'suggest'

export function RightPanel({
  suggestions = [],
  onApprove,
  onReject,
  suggestNonce = 0,
  onRunAgents,
  agentBusy = false,
}: {
  suggestions?: AISuggestion[]
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  /** Bumped after a template apply so the Suggest tab opens without a store. */
  suggestNonce?: number
  onRunAgents?: () => void
  agentBusy?: boolean
}) {
  const [tab, setTab] = useState<RightTab>('inspector')
  const pending = suggestions.filter((entry) => entry.status === 'PENDING').length
  const tabs: readonly TabItem<RightTab>[] = [
    { id: 'inspector', label: 'Inspect' },
    { id: 'suggest', label: pending > 0 ? `Suggest (${pending})` : 'Suggest' },
  ]

  useEffect(() => {
    if (suggestNonce > 0) setTab('suggest')
  }, [suggestNonce])

  return (
    <aside
      data-testid="right-panel"
      className="flex w-[288px] shrink-0 flex-col border-l border-shell-border bg-white"
    >
      <Tabs items={tabs} value={tab} onChange={setTab} />
      {tab === 'inspector' ? (
        <Inspector />
      ) : (
        <SuggestionPanel
          suggestions={suggestions}
          onApprove={onApprove ?? (() => undefined)}
          onReject={onReject ?? (() => undefined)}
          onRunAgents={onRunAgents}
          agentBusy={agentBusy}
        />
      )}
    </aside>
  )
}
