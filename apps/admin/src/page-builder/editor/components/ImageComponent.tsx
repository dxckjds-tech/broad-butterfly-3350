import { Image as ImageIcon } from 'lucide-react'
import { registerComponent } from '../core/registry'
import type { InspectorProps, RendererProps } from '../core/registry'
import { getEnum, getString } from '../core/props'
import { FieldRow } from '../inspector/controls/FieldRow'
import { SelectInput, TextInput } from '../inspector/controls/inputs'

const FITS = ['cover', 'contain', 'fill', 'none'] as const
type Fit = (typeof FITS)[number]

const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400">' +
      '<rect width="640" height="400" fill="#e2e8f0"/>' +
      '<path d="M0 400 L240 190 L400 320 L500 250 L640 360 L640 400 Z" fill="#cbd5e1"/>' +
      '<circle cx="470" cy="110" r="46" fill="#cbd5e1"/>' +
      '</svg>',
  )

function ImageRenderer({ node, chrome }: RendererProps) {
  const src = getString(node.props, 'src').trim()
  const fit = getEnum<Fit>(node.props, 'objectFit', FITS, 'cover')
  return (
    <img
      {...chrome}
      src={src === '' ? PLACEHOLDER : src}
      alt={getString(node.props, 'alt')}
      style={{ objectFit: fit, ...chrome.style }}
    />
  )
}

function ImageInspector({ node, updateProps }: InspectorProps) {
  return (
    <>
      <FieldRow label="Source" stacked>
        <TextInput
          value={getString(node.props, 'src')}
          placeholder="https://… (blank shows a placeholder)"
          onChange={(value) => updateProps({ src: value })}
        />
      </FieldRow>
      <FieldRow label="Alt text" stacked>
        <TextInput
          value={getString(node.props, 'alt')}
          placeholder="Describe the image"
          onChange={(value) => updateProps({ alt: value })}
        />
      </FieldRow>
      <FieldRow label="Fit">
        <SelectInput
          value={getEnum<Fit>(node.props, 'objectFit', FITS, 'cover')}
          options={FITS.map((entry) => ({ label: entry, value: entry }))}
          onChange={(value) => updateProps({ objectFit: value })}
        />
      </FieldRow>
    </>
  )
}

registerComponent({
  type: 'image',
  label: 'Image',
  icon: ImageIcon,
  category: 'media',
  description: 'Responsive image with alt text',
  acceptsChildren: false,
  defaultProps: { src: '', alt: '', objectFit: 'cover' },
  defaultStyles: {
    desktop: { display: 'block', width: '100%', height: 'auto', borderRadius: '8px' },
  },
  renderer: ImageRenderer,
  inspector: ImageInspector,
})
