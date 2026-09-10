import { RotateCcw } from 'lucide-react'
import { STYLE_GROUPS, fieldKeys } from './styleFields'
import type { StyleField } from './styleFields'
import { PanelSection } from './controls/PanelSection'
import { FieldRow, FieldStateLegend } from './controls/FieldRow'
import type { FieldState } from './controls/FieldRow'
import { ColorInput, NumberInput, SegmentedInput, SelectInput, TextInput } from './controls/inputs'
import { DimensionInput } from './controls/DimensionInput'
import { SidesInput } from './controls/SidesInput'
import { hasOverride, originOf, resolveNodeStyles } from '../core/styles'
import type { Device, EditorNode, StyleMap, StyleValue } from '../core/types'
import { cn } from '../../utils/cn'

interface StyleTabProps {
  node: EditorNode
  device: Device
  updateStyle: (patch: Record<string, StyleValue | null>) => void
}

export function StyleTab({ node, device, updateStyle }: StyleTabProps) {
  const resolved = resolveNodeStyles(node, device)
  const overrideCount = Object.keys(node.styles[device] ?? {}).length

  /** A row is overridden if any key it writes is declared on this layer. */
  const stateOf = (field: StyleField): { state: FieldState; from: Device | null } => {
    const keys = fieldKeys(field)
    if (keys.some((key) => hasOverride(node.styles, device, key))) {
      return { state: 'overridden', from: device }
    }
    for (const key of keys) {
      const origin = originOf(node.styles, device, key)
      if (origin) return { state: 'inherited', from: origin }
    }
    return { state: 'unset', from: null }
  }

  return (
    <div>
      <DeviceLayerBanner
        device={device}
        overrideCount={overrideCount}
        onClear={() => {
          const cleared: Record<string, StyleValue | null> = {}
          for (const key of Object.keys(node.styles[device] ?? {})) cleared[key] = null
          updateStyle(cleared)
        }}
      />
      {STYLE_GROUPS.map((group) => {
        const touched = group.fields.some((field) =>
          fieldKeys(field).some((key) => hasOverride(node.styles, device, key)),
        )
        return (
          <PanelSection
            key={group.id}
            title={group.label}
            defaultOpen={group.defaultOpen ?? touched}
            badge={touched ? <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> : null}
          >
            <div className={cn(group.columns === 2 && 'grid grid-cols-2 gap-x-3')}>
              {group.fields.map((field) => {
                const { state, from } = stateOf(field)
                return (
                  <FieldRow
                    key={field.key}
                    label={field.label}
                    stacked={group.columns === 2 || field.control.kind === 'sides'}
                    state={state}
                    inheritedFrom={from}
                    onReset={() => {
                      const cleared: Record<string, StyleValue | null> = {}
                      for (const key of fieldKeys(field)) cleared[key] = null
                      updateStyle(cleared)
                    }}
                  >
                    <StyleControlInput field={field} resolved={resolved} onPatch={updateStyle} />
                  </FieldRow>
                )
              })}
            </div>
          </PanelSection>
        )
      })}
    </div>
  )
}

interface DeviceLayerBannerProps {
  device: Device
  overrideCount: number
  onClear: () => void
}

function DeviceLayerBanner({ device, overrideCount, onClear }: DeviceLayerBannerProps) {
  const isBase = device === 'desktop'
  return (
    <div className="space-y-1.5 border-b border-shell-border bg-slate-50 px-3 py-2 text-[11px] leading-snug text-slate-500">
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1">
          {isBase ? (
            <>
              Editing the <span className="font-medium text-slate-700">desktop</span> base layer —
              tablet and mobile inherit from it.
            </>
          ) : (
            <>
              Editing the <span className="font-medium text-slate-700">{device}</span> override
              layer. Blank fields fall back to the wider breakpoint.{' '}
              <span className="tabular-nums">{overrideCount}</span> override
              {overrideCount === 1 ? '' : 's'} set.
            </>
          )}
        </span>
        {!isBase && overrideCount > 0 ? (
          <button
            type="button"
            title={`Reset every ${device} override`}
            onClick={onClear}
            className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100"
          >
            <RotateCcw size={10} />
            Reset breakpoint
          </button>
        ) : null}
      </div>
      <FieldStateLegend />
    </div>
  )
}

interface StyleControlInputProps {
  field: StyleField
  resolved: StyleMap
  onPatch: (patch: Record<string, StyleValue | null>) => void
}

function StyleControlInput({ field, resolved, onPatch }: StyleControlInputProps) {
  const { control } = field
  const raw = resolved[field.key]
  const asString = raw === undefined ? '' : String(raw)
  const write = (value: StyleValue | null) => onPatch({ [field.key]: value })

  switch (control.kind) {
    case 'text':
      return (
        <TextInput
          value={asString}
          placeholder={control.placeholder}
          onChange={(next) => write(next === '' ? null : next)}
        />
      )
    case 'dimension':
      return (
        <DimensionInput
          value={asString}
          keywords={control.keywords}
          fallbackUnit={control.fallbackUnit}
          placeholder={control.placeholder}
          onChange={write}
        />
      )
    case 'sides': {
      const values = control.keys.map((key) => {
        const value = resolved[key]
        return value === undefined ? '' : String(value)
      }) as [string, string, string, string]
      return <SidesInput keys={control.keys} values={values} onPatch={onPatch} />
    }
    case 'number':
      return (
        <NumberInput
          value={raw === undefined || raw === '' ? '' : Number(raw)}
          min={control.min}
          max={control.max}
          step={control.step}
          onChange={write}
        />
      )
    case 'color':
      return <ColorInput value={asString} onChange={(next) => write(next === '' ? null : next)} />
    case 'select':
      return (
        <SelectInput
          value={asString}
          options={control.options}
          onChange={(next) => write(next === '' ? null : next)}
        />
      )
    case 'segmented':
      return (
        <SegmentedInput
          value={asString}
          options={control.options.map((option) => ({ label: option.label, value: option.value }))}
          onChange={write}
        />
      )
  }
}
