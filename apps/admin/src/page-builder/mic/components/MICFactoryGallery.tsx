/**
 * MIC factory / production / certificate gallery.
 */
import { Factory } from 'lucide-react'
import { registerComponent } from '../../editor/core/registry'
import type { InspectorProps, RendererProps } from '../../editor/core/registry'
import { FieldRow } from '../../editor/inspector/controls/FieldRow'
import { TextArea } from '../../editor/inspector/controls/inputs'
import { cn } from '../../utils/cn'
import { MIC_ALLOWED_PARENTS } from './types'
import { MicEmpty, MicFrame, MicPlaceholder, MicSectionTitle } from './shared'
import { readGalleryList } from './readProps'
import type { GalleryItem } from './readProps'

export interface FactoryGalleryProps {
  images: GalleryItem[]
}

const GALLERY_TYPES = new Set(['factory', 'production', 'certificate'])

export function MICFactoryGallery({ images }: FactoryGalleryProps) {
  const items = (images ?? []).filter((item) => item.url.trim() !== '')
  return (
    <MicFrame testId="mic-factory-gallery">
      <MicSectionTitle>Factory</MicSectionTitle>
      {items.length === 0 ? (
        <MicEmpty>No factory images</MicEmpty>
      ) : (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {items.map((item, index) => {
            const kind = GALLERY_TYPES.has(item.type) ? item.type : 'factory'
            return (
              <figure key={`${item.url}-${index}`} className="m-0 overflow-hidden rounded-md border border-slate-200">
                {item.url.trim() === '' ? (
                  <MicPlaceholder label="Factory photo" />
                ) : (
                  <img src={item.url} alt={kind} className="h-32 w-full object-cover" />
                )}
                <figcaption className="bg-slate-50 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-500">
                  {kind}
                </figcaption>
              </figure>
            )
          })}
        </div>
      )}
    </MicFrame>
  )
}

function GalleryRenderer({ node, chrome }: RendererProps) {
  return (
    <section {...chrome} className={cn(chrome.className)}>
      <MICFactoryGallery images={readGalleryList(node.props['images'])} />
    </section>
  )
}

function GalleryInspector({ node, updateProps }: InspectorProps) {
  const images = readGalleryList(node.props['images'])
  return (
    <FieldRow label="Images" stacked hint="One per line: url | factory|production|certificate">
      <TextArea
        rows={6}
        value={images.map((item) => `${item.url} | ${item.type}`).join('\n')}
        placeholder="https://… | factory"
        onChange={(value) =>
          updateProps({
            images: value
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line.length > 0)
              .map((line) => {
                const [url, type] = line.split('|').map((part) => part.trim())
                return { url: url ?? '', type: type || 'factory' }
              }),
          })
        }
      />
    </FieldRow>
  )
}

registerComponent({
  type: 'mic-factory-gallery',
  label: 'MIC Factory',
  icon: Factory,
  category: 'media',
  description: 'Factory / production / certificate photos',
  acceptsChildren: false,
  allowedParents: MIC_ALLOWED_PARENTS,
  defaultProps: { images: [] },
  defaultStyles: { desktop: { width: '100%', paddingTop: '16px', paddingBottom: '16px' } },
  renderer: GalleryRenderer,
  inspector: GalleryInspector,
})
