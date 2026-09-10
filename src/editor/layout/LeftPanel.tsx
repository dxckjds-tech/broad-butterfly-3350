import { useState } from 'react'
import type { ReactNode } from 'react'
import { Tabs } from '../ui/Tabs'
import type { TabItem } from '../ui/Tabs'
import { ComponentPalette } from './ComponentPalette'
import { SectionsPanel } from './SectionsPanel'
import { TemplatesPanel } from './TemplatesPanel'
import { LayersPanel } from '../layers/LayersPanel'
import { TemplateCenter } from '../../mic/templates/ui/TemplateCenter'

type LeftTab = 'components' | 'layers' | 'templates' | 'sections'

const TABS: readonly TabItem<LeftTab>[] = [
  { id: 'components', label: 'Build' },
  { id: 'layers', label: 'Layers' },
  { id: 'templates', label: 'Templates' },
  { id: 'sections', label: 'Sections' },
]

export function LeftPanel({ onSelectMicTemplate }: { onSelectMicTemplate?: (templateId: string) => void }) {
  const [tab, setTab] = useState<LeftTab>('components')
  const micTemplates: ReactNode = onSelectMicTemplate ? (
    <TemplateCenter onSelect={onSelectMicTemplate} />
  ) : null

  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r border-shell-border bg-white">
      <Tabs items={TABS} value={tab} onChange={setTab} />
      {tab === 'components' ? <ComponentPalette /> : null}
      {tab === 'layers' ? <LayersPanel /> : null}
      {tab === 'templates' ? <TemplatesPanel micTemplates={micTemplates} /> : null}
      {tab === 'sections' ? <SectionsPanel /> : null}
    </aside>
  )
}
