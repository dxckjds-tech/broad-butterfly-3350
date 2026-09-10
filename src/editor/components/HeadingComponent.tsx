import { createElement } from 'react'
import { Type } from 'lucide-react'
import { registerComponent } from '../core/registry'
import type { InspectorProps, RendererProps } from '../core/registry'
import { getEnum, getString } from '../core/props'
import { FieldRow } from '../inspector/controls/FieldRow'
import { SegmentedInput, TextArea } from '../inspector/controls/inputs'

const LEVELS = ['h1', 'h2', 'h3', 'h4'] as const
type Level = (typeof LEVELS)[number]

function HeadingRenderer({ node, chrome }: RendererProps) {
  const level = getEnum<Level>(node.props, 'level', LEVELS, 'h2')
  const text = getString(node.props, 'text', 'Heading')
  return createElement(level, chrome, text)
}

function HeadingInspector({ node, updateProps }: InspectorProps) {
  const level = getEnum<Level>(node.props, 'level', LEVELS, 'h2')
  return (
    <>
      <FieldRow label="Text" stacked>
        <TextArea
          value={getString(node.props, 'text')}
          rows={3}
          placeholder="Heading text"
          onChange={(value) => updateProps({ text: value })}
        />
      </FieldRow>
      <FieldRow label="Level">
        <SegmentedInput<Level>
          value={level}
          options={LEVELS.map((entry) => ({ label: entry.toUpperCase(), value: entry }))}
          onChange={(value) => updateProps({ level: value })}
        />
      </FieldRow>
    </>
  )
}

registerComponent({
  type: 'heading',
  label: 'Heading',
  icon: Type,
  category: 'basic',
  description: 'H1–H4 title text',
  acceptsChildren: false,
  defaultProps: { text: 'Your headline goes here', level: 'h2' },
  defaultStyles: {
    desktop: {
      margin: '0px',
      fontSize: '36px',
      fontWeight: 700,
      lineHeight: 1.2,
      color: '#0f172a',
    },
    mobile: { fontSize: '26px' },
  },
  renderer: HeadingRenderer,
  inspector: HeadingInspector,
})
