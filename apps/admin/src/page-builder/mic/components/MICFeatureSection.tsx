/**
 * MIC feature / selling-point cards. Renders 1–6 items; extra entries are ignored.
 */
import { Sparkles } from 'lucide-react'
import { registerComponent } from '../../editor/core/registry'
import type { InspectorProps, RendererProps } from '../../editor/core/registry'
import { FieldRow } from '../../editor/inspector/controls/FieldRow'
import { TextArea } from '../../editor/inspector/controls/inputs'
import { cn } from '../../utils/cn'
import { MIC_ALLOWED_PARENTS } from './types'
import { MicEmpty, MicFrame, MicPlaceholder, MicSectionTitle } from './shared'
import { readFeatureList } from './readProps'
import type { FeatureItem } from './readProps'

export interface FeatureSectionProps {
  features: FeatureItem[]
}

const MAX_FEATURES = 6

export function MICFeatureSection({ features }: FeatureSectionProps) {
  const cards = (features ?? []).slice(0, MAX_FEATURES)
  return (
    <MicFrame testId="mic-feature-section">
      <MicSectionTitle>Key features</MicSectionTitle>
      {cards.length === 0 ? (
        <MicEmpty>No features available</MicEmpty>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, index) => (
            <article
              key={`${card.title}-${index}`}
              className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3"
            >
              {card.image && card.image.trim() !== '' ? (
                <img src={card.image} alt="" className="h-28 w-full rounded object-cover" />
              ) : (
                <MicPlaceholder label="Feature image" />
              )}
              <h3 className="m-0 text-[14px] font-semibold text-slate-900">
                {card.title.trim() === '' ? `Feature ${index + 1}` : card.title}
              </h3>
              {card.description.trim() !== '' ? (
                <p className="m-0 text-[13px] leading-relaxed text-slate-600">{card.description}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </MicFrame>
  )
}

function serialiseFeatures(features: FeatureItem[]): string {
  return features
    .map((item) => [item.title, item.description, item.image ?? ''].join(' | '))
    .join('\n')
}

function parseFeatureLines(text: string): FeatureItem[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, MAX_FEATURES)
    .map((line) => {
      const [title, description, image] = line.split('|').map((part) => part.trim())
      const item: FeatureItem = { title: title ?? '', description: description ?? '' }
      if (image) item.image = image
      return item
    })
}

function FeatureRenderer({ node, chrome }: RendererProps) {
  return (
    <section {...chrome} className={cn(chrome.className)}>
      <MICFeatureSection features={readFeatureList(node.props['features'])} />
    </section>
  )
}

function FeatureInspector({ node, updateProps }: InspectorProps) {
  const features = readFeatureList(node.props['features'])
  return (
    <FieldRow label="Features" stacked hint="One per line: title | description | image URL. Max 6.">
      <TextArea
        rows={8}
        value={serialiseFeatures(features)}
        placeholder="High torque | Stable cutting | https://…"
        onChange={(value) => updateProps({ features: parseFeatureLines(value) })}
      />
    </FieldRow>
  )
}

registerComponent({
  type: 'mic-feature-section',
  label: 'MIC Features',
  icon: Sparkles,
  category: 'basic',
  description: '1–6 MIC selling-point cards',
  acceptsChildren: false,
  allowedParents: MIC_ALLOWED_PARENTS,
  defaultProps: { features: [] },
  defaultStyles: { desktop: { width: '100%', paddingTop: '16px', paddingBottom: '16px' } },
  renderer: FeatureRenderer,
  inspector: FeatureInspector,
})
