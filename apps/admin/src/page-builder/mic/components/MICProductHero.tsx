/**
 * MIC product hero — first screen of a Made-in-China detail page.
 * Data-driven: only renders `props`. Does not read AI APIs or write schema.
 */
import { LayoutTemplate } from 'lucide-react'
import { registerComponent } from '../../editor/core/registry'
import type { InspectorProps, RendererProps } from '../../editor/core/registry'
import { getString, getStringArray } from '../../editor/core/props'
import { FieldRow } from '../../editor/inspector/controls/FieldRow'
import { TextArea, TextInput } from '../../editor/inspector/controls/inputs'
import { cn } from '../../utils/cn'
import { MIC_ALLOWED_PARENTS } from './types'
import { MicFrame, MicPlaceholder } from './shared'
import { readStringList } from './readProps'

export interface ProductHeroProps {
  title: string
  mainImage?: string
  keywords?: string[]
  highlights?: string[]
}

export function MICProductHero({ title, mainImage, keywords, highlights }: ProductHeroProps) {
  const tags = (keywords ?? []).filter((entry) => entry.trim() !== '')
  const points = (highlights ?? []).filter((entry) => entry.trim() !== '')
  const image = (mainImage ?? '').trim()

  return (
    <MicFrame className="gap-5 md:flex-row md:items-start" testId="mic-product-hero">
      <div className="min-w-0 flex-1">
        {image === '' ? (
          <MicPlaceholder label="No product image" />
        ) : (
          <img
            src={image}
            alt={title || 'Product'}
            className="block w-full rounded-md object-cover"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <h1 className="m-0 text-[28px] font-semibold leading-tight text-slate-900">
          {title.trim() === '' ? 'Untitled product' : title}
        </h1>
        {points.length > 0 ? (
          <ul className="m-0 list-disc space-y-1 pl-5 text-[14px] text-slate-700">
            {points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        ) : null}
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </MicFrame>
  )
}

function HeroRenderer({ node, chrome }: RendererProps) {
  return (
    <section {...chrome} className={cn(chrome.className)}>
      <MICProductHero
        title={getString(node.props, 'title')}
        mainImage={getString(node.props, 'mainImage') || undefined}
        keywords={getStringArray(node.props, 'keywords')}
        highlights={getStringArray(node.props, 'highlights')}
      />
    </section>
  )
}

function HeroInspector({ node, updateProps }: InspectorProps) {
  return (
    <>
      <FieldRow label="Title" stacked>
        <TextInput
          value={getString(node.props, 'title')}
          placeholder="Product name"
          onChange={(value) => updateProps({ title: value })}
        />
      </FieldRow>
      <FieldRow label="Image URL" stacked>
        <TextInput
          value={getString(node.props, 'mainImage')}
          placeholder="https://…"
          onChange={(value) => updateProps({ mainImage: value })}
        />
      </FieldRow>
      <FieldRow label="Keywords" stacked hint="Comma separated. Empty hides tags.">
        <TextInput
          value={getStringArray(node.props, 'keywords').join(', ')}
          placeholder="vacuum, cordless"
          onChange={(value) => updateProps({ keywords: readStringList(value) })}
        />
      </FieldRow>
      <FieldRow label="Highlights" stacked hint="One selling point per line.">
        <TextArea
          rows={4}
          value={getStringArray(node.props, 'highlights').join('\n')}
          placeholder="Lightweight body"
          onChange={(value) =>
            updateProps({
              highlights: value
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.length > 0),
            })
          }
        />
      </FieldRow>
    </>
  )
}

registerComponent({
  type: 'mic-product-hero',
  label: 'MIC Hero',
  icon: LayoutTemplate,
  category: 'basic',
  description: 'MIC product title, main image, keywords and highlights',
  acceptsChildren: false,
  allowedParents: MIC_ALLOWED_PARENTS,
  defaultProps: {
    title: 'Product name',
    mainImage: '',
    keywords: [],
    highlights: [],
  },
  defaultStyles: {
    desktop: { width: '100%', paddingTop: '24px', paddingBottom: '24px' },
  },
  renderer: HeroRenderer,
  inspector: HeroInspector,
})
