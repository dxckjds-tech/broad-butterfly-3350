import { useState } from 'react'
import { MousePointer2 } from 'lucide-react'
import { Tabs } from '../ui/Tabs'
import type { TabItem } from '../ui/Tabs'
import { useEditorStore } from '../store/editorStore'
import { useSelectedNode } from '../hooks/useSelectedNode'
import { getComponent } from '../core/registry'
import type { StyleValue } from '../core/types'
import { ContentTab } from './ContentTab'
import { StyleTab } from './StyleTab'
import { AdvancedTab } from './AdvancedTab'

type InspectorTab = 'content' | 'style' | 'advanced'

const TABS: readonly TabItem<InspectorTab>[] = [
  { id: 'content', label: 'Content' },
  { id: 'style', label: 'Style' },
  { id: 'advanced', label: 'Advanced' },
]

export function Inspector() {
  const [tab, setTab] = useState<InspectorTab>('content')
  const node = useSelectedNode()
  const device = useEditorStore((state) => state.device)
  const dispatch = useEditorStore((state) => state.dispatch)

  if (!node) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <MousePointer2 size={20} className="text-slate-300" />
        <p className="text-[11px] leading-relaxed text-slate-400">
          Select an element on the canvas to edit its content and style.
        </p>
      </div>
    )
  }

  const updateProps = (patch: Record<string, unknown>) =>
    dispatch({ type: 'UPDATE_PROPS', nodeId: node.id, patch })

  const updateStyle = (patch: Record<string, StyleValue | null>) =>
    dispatch({ type: 'UPDATE_STYLE', nodeId: node.id, device, patch })

  const definition = getComponent(node.type)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-shell-border px-3 py-2">
        {definition ? <definition.icon size={14} className="shrink-0 text-slate-400" /> : null}
        <span className="truncate text-[12px] font-medium text-slate-700">
          {definition?.label ?? node.type}
        </span>
        <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-400">{node.id}</span>
      </div>

      <Tabs items={TABS} value={tab} onChange={setTab} />

      <div className="pb-scroll min-h-0 flex-1 overflow-y-auto">
        {tab === 'content' ? (
          <ContentTab
            node={node}
            device={device}
            updateProps={updateProps}
            updateStyle={updateStyle}
          />
        ) : null}
        {tab === 'style' ? (
          <StyleTab node={node} device={device} updateStyle={updateStyle} />
        ) : null}
        {tab === 'advanced' ? <AdvancedTab node={node} updateProps={updateProps} /> : null}
      </div>
    </div>
  )
}
