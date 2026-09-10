/**
 * MIC specification table. Empty data renders a fallback string — never throws.
 */
import { Table } from 'lucide-react'
import { registerComponent } from '../../editor/core/registry'
import type { InspectorProps, RendererProps } from '../../editor/core/registry'
import { FieldRow } from '../../editor/inspector/controls/FieldRow'
import { TextArea } from '../../editor/inspector/controls/inputs'
import { cn } from '../../utils/cn'
import { MIC_ALLOWED_PARENTS } from './types'
import { MicEmpty, MicFrame, MicSectionTitle } from './shared'
import { readSpecList } from './readProps'
import type { SpecItem } from './readProps'

export interface SpecificationTableProps {
  specifications: SpecItem[]
}

export function MICSpecificationTable({ specifications }: SpecificationTableProps) {
  const rows = specifications ?? []
  return (
    <MicFrame testId="mic-specification-table">
      <MicSectionTitle>Specifications</MicSectionTitle>
      {rows.length === 0 ? (
        <MicEmpty>No specifications available</MicEmpty>
      ) : (
        <table className="w-full border-collapse text-left text-[13px]">
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.name}-${index}`} className={index % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                <th className="w-[40%] px-3 py-2 font-medium text-slate-600">{row.name || '—'}</th>
                <td className="px-3 py-2 text-slate-800">{row.value || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </MicFrame>
  )
}

function SpecRenderer({ node, chrome }: RendererProps) {
  return (
    <section {...chrome} className={cn(chrome.className)}>
      <MICSpecificationTable specifications={readSpecList(node.props['specifications'])} />
    </section>
  )
}

function SpecInspector({ node, updateProps }: InspectorProps) {
  const rows = readSpecList(node.props['specifications'])
  return (
    <FieldRow label="Specs" stacked hint="One per line: name | value">
      <TextArea
        rows={8}
        value={rows.map((row) => `${row.name} | ${row.value}`).join('\n')}
        placeholder="Voltage | 220V"
        onChange={(value) =>
          updateProps({
            specifications: value
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line.length > 0)
              .map((line) => {
                const [name, ...rest] = line.split('|')
                return { name: (name ?? '').trim(), value: rest.join('|').trim() }
              }),
          })
        }
      />
    </FieldRow>
  )
}

registerComponent({
  type: 'mic-specification-table',
  label: 'MIC Specs',
  icon: Table,
  category: 'basic',
  description: 'MIC technical parameter table',
  acceptsChildren: false,
  allowedParents: MIC_ALLOWED_PARENTS,
  defaultProps: { specifications: [] },
  defaultStyles: { desktop: { width: '100%', paddingTop: '16px', paddingBottom: '16px' } },
  renderer: SpecRenderer,
  inspector: SpecInspector,
})
