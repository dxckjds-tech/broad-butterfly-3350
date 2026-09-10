import { MoveVertical } from 'lucide-react'
import { registerComponent } from '../core/registry'
import type { InspectorProps, RendererProps } from '../core/registry'
import { FieldRow } from '../inspector/controls/FieldRow'
import { NumberInput } from '../inspector/controls/inputs'
import { resolveNodeStyles } from '../core/styles'

function SpacerRenderer({ chrome, preview }: RendererProps) {
  return (
    <div
      {...chrome}
      style={{
        ...chrome.style,
        ...(preview
          ? {}
          : {
              backgroundImage:
                'repeating-linear-gradient(45deg, #f1f5f9 0 6px, transparent 6px 12px)',
            }),
      }}
    />
  )
}

function SpacerInspector({ node, updateStyle, device }: InspectorProps) {
  const height = resolveNodeStyles(node, device)['height']
  const numeric = typeof height === 'number' ? height : Number.parseInt(String(height ?? '24'), 10)
  return (
    <FieldRow label="Height" hint="px">
      <NumberInput
        value={Number.isFinite(numeric) ? numeric : 24}
        min={0}
        max={480}
        step={4}
        onChange={(value) => updateStyle({ height: value === null ? null : `${value}px` })}
      />
    </FieldRow>
  )
}

registerComponent({
  type: 'spacer',
  label: 'Spacer',
  icon: MoveVertical,
  category: 'layout',
  description: 'Vertical gap with a per-device height',
  acceptsChildren: false,
  defaultProps: {},
  defaultStyles: { desktop: { height: '40px', width: '100%' }, mobile: { height: '24px' } },
  renderer: SpacerRenderer,
  inspector: SpacerInspector,
})
