import { DEVICES } from '../core/types'
import type { Device, EditorNode } from '../core/types'
import { getString, getStringArray } from '../core/props'
import { FieldRow } from './controls/FieldRow'
import { TextInput } from './controls/inputs'
import { PanelSection } from './controls/PanelSection'
import { cn } from '../../utils/cn'

interface AdvancedTabProps {
  node: EditorNode
  updateProps: (patch: Record<string, unknown>) => void
}

export function AdvancedTab({ node, updateProps }: AdvancedTabProps) {
  const hiddenOn = getStringArray(node.props, 'hiddenOn')

  const toggleDevice = (device: Device) => {
    const next = hiddenOn.includes(device)
      ? hiddenOn.filter((entry) => entry !== device)
      : [...hiddenOn, device]
    updateProps({ hiddenOn: next })
  }

  return (
    <div>
      <div className="space-y-1 px-3 py-2">
        <FieldRow label="Anchor id" stacked>
          <TextInput
            value={getString(node.props, 'htmlId')}
            placeholder="pricing"
            onChange={(value) => updateProps({ htmlId: value })}
          />
        </FieldRow>
        <FieldRow label="CSS classes" stacked>
          <TextInput
            value={getString(node.props, 'className')}
            placeholder="promo-card featured"
            onChange={(value) => updateProps({ className: value })}
          />
        </FieldRow>
        <FieldRow label="Visibility" stacked>
          <div className="flex gap-1">
            {DEVICES.map((device) => {
              const hidden = hiddenOn.includes(device)
              return (
                <button
                  key={device}
                  type="button"
                  onClick={() => toggleDevice(device)}
                  className={cn(
                    'flex-1 rounded-md border px-1.5 py-1 text-[11px] capitalize transition-colors',
                    hidden
                      ? 'border-slate-200 bg-slate-100 text-slate-400 line-through'
                      : 'border-brand-200 bg-brand-50 text-brand-700',
                  )}
                >
                  {device}
                </button>
              )
            })}
          </div>
        </FieldRow>
      </div>

      <PanelSection title="Node JSON">
        <pre className="pb-scroll max-h-64 overflow-auto rounded-md bg-slate-900 p-2 font-mono text-[10px] leading-relaxed text-slate-200">
          {JSON.stringify(node, null, 2)}
        </pre>
      </PanelSection>
    </div>
  )
}
