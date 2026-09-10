import { AlignLeft } from 'lucide-react'
import { registerComponent } from '../core/registry'
import type { InspectorProps, RendererProps } from '../core/registry'
import { getString } from '../core/props'
import { FieldRow } from '../inspector/controls/FieldRow'
import { TextArea } from '../inspector/controls/inputs'

function TextRenderer({ node, chrome }: RendererProps) {
  const text = getString(node.props, 'text', 'Text block')
  // Plain text with preserved newlines — no HTML injection surface.
  return (
    <p {...chrome} style={{ whiteSpace: 'pre-wrap', ...chrome.style }}>
      {text}
    </p>
  )
}

function TextInspector({ node, updateProps }: InspectorProps) {
  return (
    <FieldRow label="Text" stacked>
      <TextArea
        value={getString(node.props, 'text')}
        rows={6}
        placeholder="Paragraph text"
        onChange={(value) => updateProps({ text: value })}
      />
    </FieldRow>
  )
}

registerComponent({
  type: 'text',
  label: 'Text',
  icon: AlignLeft,
  category: 'basic',
  description: 'Paragraph of body copy',
  acceptsChildren: false,
  defaultProps: {
    text: 'Describe the value of your product in one or two short sentences.',
  },
  defaultStyles: {
    desktop: { margin: '0px', fontSize: '16px', lineHeight: 1.65, color: '#475569' },
  },
  renderer: TextRenderer,
  inspector: TextInspector,
})
