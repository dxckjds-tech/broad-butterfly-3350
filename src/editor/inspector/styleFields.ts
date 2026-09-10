import type { SelectOption } from './controls/inputs'
import type { DimensionUnit, LengthUnit } from './dimension'

/**
 * The Style tab is data-driven: adding a control means adding an entry here,
 * not writing JSX. Keys are camelCase CSS properties written straight into
 * the node's style layer for the active device.
 */
export type StyleControl =
  | { kind: 'text'; placeholder?: string }
  /** Amount + unit (px/%/rem/em/vw/vh plus any keywords listed). */
  | { kind: 'dimension'; keywords?: readonly DimensionUnit[]; fallbackUnit?: LengthUnit; placeholder?: string }
  /** Four linked sides — `keys` are top, right, bottom, left. */
  | { kind: 'sides'; keys: readonly [string, string, string, string] }
  | { kind: 'number'; min?: number; max?: number; step?: number; unit?: string }
  | { kind: 'color' }
  | { kind: 'select'; options: readonly SelectOption[] }
  | { kind: 'segmented'; options: readonly SelectOption[] }

export interface StyleField {
  /** Identity of the row; also the style key for single-key controls. */
  key: string
  label: string
  control: StyleControl
}

/**
 * Style keys a field writes. Multi-key controls (spacing) must report all of
 * them so override detection and per-property reset stay correct.
 */
export function fieldKeys(field: StyleField): readonly string[] {
  return field.control.kind === 'sides' ? field.control.keys : [field.key]
}

export interface StyleGroup {
  id: string
  label: string
  defaultOpen?: boolean
  /** Two-column grid for tight groups like spacing. */
  columns?: 1 | 2
  fields: readonly StyleField[]
}

const FONT_FAMILIES: readonly SelectOption[] = [
  { label: 'Inherit', value: 'inherit' },
  { label: 'Sans', value: 'Inter, system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Mono', value: 'ui-monospace, SFMono-Regular, monospace' },
]

const FONT_WEIGHTS: readonly SelectOption[] = [
  { label: 'Regular 400', value: '400' },
  { label: 'Medium 500', value: '500' },
  { label: 'Semibold 600', value: '600' },
  { label: 'Bold 700', value: '700' },
  { label: 'Black 800', value: '800' },
]

const TEXT_ALIGN: readonly SelectOption[] = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
]

const DISPLAY: readonly SelectOption[] = [
  { label: 'block', value: 'block' },
  { label: 'flex', value: 'flex' },
  { label: 'inline-flex', value: 'inline-flex' },
  { label: 'grid', value: 'grid' },
  { label: 'none', value: 'none' },
]

const FLEX_DIRECTION: readonly SelectOption[] = [
  { label: 'Row', value: 'row' },
  { label: 'Column', value: 'column' },
]

const JUSTIFY: readonly SelectOption[] = [
  { label: 'Start', value: 'flex-start' },
  { label: 'Center', value: 'center' },
  { label: 'End', value: 'flex-end' },
  { label: 'Between', value: 'space-between' },
]

const ALIGN: readonly SelectOption[] = [
  { label: 'Start', value: 'flex-start' },
  { label: 'Center', value: 'center' },
  { label: 'End', value: 'flex-end' },
  { label: 'Stretch', value: 'stretch' },
]

const BORDER_STYLE: readonly SelectOption[] = [
  { label: 'Solid', value: 'solid' },
  { label: 'Dashed', value: 'dashed' },
  { label: 'Dotted', value: 'dotted' },
  { label: 'None', value: 'none' },
]

export const SHADOW_PRESETS: readonly SelectOption[] = [
  { label: 'None', value: 'none' },
  { label: 'Subtle', value: '0 1px 2px rgba(15,23,42,0.06)' },
  { label: 'Small', value: '0 1px 3px rgba(15,23,42,0.10), 0 1px 2px rgba(15,23,42,0.06)' },
  { label: 'Medium', value: '0 4px 12px rgba(15,23,42,0.10)' },
  { label: 'Large', value: '0 12px 32px -8px rgba(15,23,42,0.22)' },
]

export const STYLE_GROUPS: readonly StyleGroup[] = [
  {
    id: 'typography',
    label: 'Typography',
    defaultOpen: true,
    fields: [
      { key: 'fontFamily', label: 'Family', control: { kind: 'select', options: FONT_FAMILIES } },
      { key: 'fontSize', label: 'Size', control: { kind: 'dimension' } },
      { key: 'fontWeight', label: 'Weight', control: { kind: 'select', options: FONT_WEIGHTS } },
      { key: 'lineHeight', label: 'Line height', control: { kind: 'text', placeholder: '1.5' } },
      { key: 'letterSpacing', label: 'Tracking', control: { kind: 'dimension' } },
      { key: 'textAlign', label: 'Align', control: { kind: 'segmented', options: TEXT_ALIGN } },
      { key: 'color', label: 'Colour', control: { kind: 'color' } },
    ],
  },
  {
    id: 'background',
    label: 'Background',
    fields: [
      { key: 'backgroundColor', label: 'Colour', control: { kind: 'color' } },
      { key: 'backgroundImage', label: 'Image', control: { kind: 'text', placeholder: 'url(…)' } },
      {
        key: 'backgroundSize',
        label: 'Size',
        control: {
          kind: 'select',
          options: [
            { label: 'cover', value: 'cover' },
            { label: 'contain', value: 'contain' },
            { label: 'auto', value: 'auto' },
          ],
        },
      },
      { key: 'backgroundPosition', label: 'Position', control: { kind: 'text', placeholder: 'center' } },
    ],
  },
  {
    id: 'layout',
    label: 'Layout',
    fields: [
      { key: 'display', label: 'Display', control: { kind: 'select', options: DISPLAY } },
      { key: 'flexDirection', label: 'Direction', control: { kind: 'segmented', options: FLEX_DIRECTION } },
      { key: 'justifyContent', label: 'Justify', control: { kind: 'select', options: JUSTIFY } },
      { key: 'alignItems', label: 'Align', control: { kind: 'select', options: ALIGN } },
      { key: 'gap', label: 'Gap', control: { kind: 'dimension' } },
    ],
  },
  {
    id: 'size',
    label: 'Size',
    fields: [
      { key: 'width', label: 'Width', control: { kind: 'dimension', keywords: ['auto'] } },
      { key: 'minWidth', label: 'Min W', control: { kind: 'dimension' } },
      { key: 'maxWidth', label: 'Max W', control: { kind: 'dimension', keywords: ['none'] } },
      { key: 'height', label: 'Height', control: { kind: 'dimension', keywords: ['auto'] } },
      { key: 'minHeight', label: 'Min H', control: { kind: 'dimension' } },
      { key: 'maxHeight', label: 'Max H', control: { kind: 'dimension', keywords: ['none'] } },
    ],
  },
  {
    id: 'spacing',
    label: 'Spacing',
    defaultOpen: true,
    fields: [
      {
        key: 'margin',
        label: 'Margin',
        control: {
          kind: 'sides',
          keys: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'],
        },
      },
      {
        key: 'padding',
        label: 'Padding',
        control: {
          kind: 'sides',
          keys: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
        },
      },
    ],
  },
  {
    id: 'border',
    label: 'Border',
    fields: [
      { key: 'borderWidth', label: 'Width', control: { kind: 'dimension' } },
      { key: 'borderStyle', label: 'Style', control: { kind: 'select', options: BORDER_STYLE } },
      { key: 'borderColor', label: 'Colour', control: { kind: 'color' } },
    ],
  },
  {
    id: 'radius',
    label: 'Border radius',
    fields: [
      { key: 'borderRadius', label: 'All', control: { kind: 'dimension' } },
      {
        key: 'borderRadiusCorners',
        label: 'Corners',
        control: {
          kind: 'sides',
          keys: [
            'borderTopLeftRadius',
            'borderTopRightRadius',
            'borderBottomRightRadius',
            'borderBottomLeftRadius',
          ],
        },
      },
    ],
  },
  {
    id: 'shadow',
    label: 'Shadow',
    fields: [
      { key: 'boxShadow', label: 'Preset', control: { kind: 'select', options: SHADOW_PRESETS } },
      { key: 'opacity', label: 'Opacity', control: { kind: 'number', min: 0, max: 1, step: 0.05 } },
    ],
  },
]
