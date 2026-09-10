import { Square } from 'lucide-react'
import { registerComponent } from '../core/registry'
import type { InspectorProps, RendererProps } from '../core/registry'
import { getEnum } from '../core/props'
import { FieldRow } from '../inspector/controls/FieldRow'
import { SegmentedInput } from '../inspector/controls/inputs'
import { EmptySlot } from './shared/EmptySlot'

const WIDTHS = ['boxed', 'full'] as const
type Width = (typeof WIDTHS)[number]

const MAX_WIDTH: Record<Width, string> = { boxed: '1140px', full: '100%' }

function SectionRenderer({ node, chrome, children, preview }: RendererProps) {
  const width = getEnum<Width>(node.props, 'contentWidth', WIDTHS, 'boxed')
  const empty = (node.children ?? []).length === 0
  return (
    <section {...chrome}>
      <div style={{ maxWidth: MAX_WIDTH[width], marginInline: 'auto', width: '100%' }}>
        {empty && !preview ? <EmptySlot label="Empty section — drop elements here" /> : children}
      </div>
    </section>
  )
}

function SectionInspector({ node, updateProps }: InspectorProps) {
  const width = getEnum<Width>(node.props, 'contentWidth', WIDTHS, 'boxed')
  return (
    <FieldRow label="Content">
      <SegmentedInput<Width>
        value={width}
        options={[
          { label: 'Boxed', value: 'boxed' },
          { label: 'Full', value: 'full' },
        ]}
        onChange={(value) => updateProps({ contentWidth: value })}
      />
    </FieldRow>
  )
}

registerComponent({
  type: 'section',
  label: 'Section',
  icon: Square,
  category: 'layout',
  description: 'Full-width band with a centred content area',
  acceptsChildren: true,
  defaultProps: { contentWidth: 'boxed' },
  defaultStyles: {
    desktop: {
      paddingTop: '56px',
      paddingBottom: '56px',
      paddingLeft: '24px',
      paddingRight: '24px',
      backgroundColor: '#ffffff',
    },
    mobile: { paddingTop: '32px', paddingBottom: '32px', paddingLeft: '16px', paddingRight: '16px' },
  },
  renderer: SectionRenderer,
  inspector: SectionInspector,
})
