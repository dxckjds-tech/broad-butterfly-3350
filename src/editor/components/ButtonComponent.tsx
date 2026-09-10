import type { MouseEvent } from 'react'
import { MousePointerClick } from 'lucide-react'
import { registerComponent } from '../core/registry'
import type { InspectorProps, RendererProps } from '../core/registry'
import { getEnum, getString } from '../core/props'
import { FieldRow } from '../inspector/controls/FieldRow'
import { SegmentedInput, TextInput } from '../inspector/controls/inputs'

const TARGETS = ['_self', '_blank'] as const
type Target = (typeof TARGETS)[number]

function ButtonRenderer({ node, chrome, preview }: RendererProps) {
  const href = getString(node.props, 'href', '#')
  const target = getEnum<Target>(node.props, 'target', TARGETS, '_self')
  return (
    <a
      {...chrome}
      href={href === '' ? '#' : href}
      target={target}
      rel={target === '_blank' ? 'noreferrer noopener' : undefined}
      onClick={(event: MouseEvent) => {
        // In edit mode a click selects the node instead of navigating.
        if (!preview) event.preventDefault()
        chrome.onClick(event)
      }}
    >
      {getString(node.props, 'label', 'Button')}
    </a>
  )
}

function ButtonInspector({ node, updateProps }: InspectorProps) {
  return (
    <>
      <FieldRow label="Label" stacked>
        <TextInput
          value={getString(node.props, 'label')}
          placeholder="Get started"
          onChange={(value) => updateProps({ label: value })}
        />
      </FieldRow>
      <FieldRow label="Link" stacked>
        <TextInput
          value={getString(node.props, 'href')}
          placeholder="https://…"
          onChange={(value) => updateProps({ href: value })}
        />
      </FieldRow>
      <FieldRow label="Target">
        <SegmentedInput<Target>
          value={getEnum<Target>(node.props, 'target', TARGETS, '_self')}
          options={[
            { label: 'Same tab', value: '_self' },
            { label: 'New tab', value: '_blank' },
          ]}
          onChange={(value) => updateProps({ target: value })}
        />
      </FieldRow>
    </>
  )
}

registerComponent({
  type: 'button',
  label: 'Button',
  icon: MousePointerClick,
  category: 'basic',
  description: 'Call-to-action link styled as a button',
  acceptsChildren: false,
  defaultProps: { label: 'Get started', href: '#', target: '_self' },
  defaultStyles: {
    desktop: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'flex-start',
      paddingTop: '10px',
      paddingBottom: '10px',
      paddingLeft: '20px',
      paddingRight: '20px',
      backgroundColor: '#2563eb',
      color: '#ffffff',
      fontSize: '14px',
      fontWeight: 600,
      borderRadius: '8px',
      textDecoration: 'none',
    },
  },
  renderer: ButtonRenderer,
  inspector: ButtonInspector,
})
