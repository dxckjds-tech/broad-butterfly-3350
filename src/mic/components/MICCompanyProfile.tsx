/**
 * MIC company profile block.
 */
import { Building2 } from 'lucide-react'
import { registerComponent } from '../../editor/core/registry'
import type { InspectorProps, RendererProps } from '../../editor/core/registry'
import { getString } from '../../editor/core/props'
import { FieldRow } from '../../editor/inspector/controls/FieldRow'
import { TextArea, TextInput } from '../../editor/inspector/controls/inputs'
import { cn } from '../../utils/cn'
import { MIC_ALLOWED_PARENTS } from './types'
import { MicEmpty, MicFrame, MicSectionTitle } from './shared'

export interface CompanyProfileProps {
  name: string
  description: string
  capacity?: string
  employees?: string
}

export function MICCompanyProfile({ name, description, capacity, employees }: CompanyProfileProps) {
  const title = (name ?? '').trim()
  const copy = (description ?? '').trim()
  const cap = (capacity ?? '').trim()
  const headcount = (employees ?? '').trim()
  const empty = title === '' && copy === '' && cap === '' && headcount === ''

  return (
    <MicFrame testId="mic-company-profile">
      <MicSectionTitle>Company</MicSectionTitle>
      {empty ? (
        <MicEmpty>No company profile</MicEmpty>
      ) : (
        <>
          {title !== '' ? <h3 className="m-0 text-[16px] font-semibold text-slate-900">{title}</h3> : null}
          {copy !== '' ? <p className="m-0 text-[14px] leading-relaxed text-slate-700">{copy}</p> : null}
          {cap !== '' || headcount !== '' ? (
            <dl className="m-0 grid grid-cols-2 gap-2 text-[13px]">
              {cap !== '' ? (
                <div>
                  <dt className="text-slate-500">Capacity</dt>
                  <dd className="m-0 font-medium text-slate-800">{cap}</dd>
                </div>
              ) : null}
              {headcount !== '' ? (
                <div>
                  <dt className="text-slate-500">Employees</dt>
                  <dd className="m-0 font-medium text-slate-800">{headcount}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </>
      )}
    </MicFrame>
  )
}

function CompanyRenderer({ node, chrome }: RendererProps) {
  const capacity = getString(node.props, 'capacity')
  const employees = getString(node.props, 'employees')
  return (
    <section {...chrome} className={cn(chrome.className)}>
      <MICCompanyProfile
        name={getString(node.props, 'name')}
        description={getString(node.props, 'description')}
        capacity={capacity === '' ? undefined : capacity}
        employees={employees === '' ? undefined : employees}
      />
    </section>
  )
}

function CompanyInspector({ node, updateProps }: InspectorProps) {
  return (
    <>
      <FieldRow label="Name" stacked>
        <TextInput
          value={getString(node.props, 'name')}
          placeholder="Ningbo Example Co., Ltd."
          onChange={(value) => updateProps({ name: value })}
        />
      </FieldRow>
      <FieldRow label="About" stacked>
        <TextArea
          rows={5}
          value={getString(node.props, 'description')}
          placeholder="OEM manufacturer…"
          onChange={(value) => updateProps({ description: value })}
        />
      </FieldRow>
      <FieldRow label="Capacity" stacked>
        <TextInput
          value={getString(node.props, 'capacity')}
          placeholder="50,000 pcs/month"
          onChange={(value) => updateProps({ capacity: value })}
        />
      </FieldRow>
      <FieldRow label="Employees" stacked>
        <TextInput
          value={getString(node.props, 'employees')}
          placeholder="200+"
          onChange={(value) => updateProps({ employees: value })}
        />
      </FieldRow>
    </>
  )
}

registerComponent({
  type: 'mic-company-profile',
  label: 'MIC Company',
  icon: Building2,
  category: 'basic',
  description: 'Supplier profile on an MIC detail page',
  acceptsChildren: false,
  allowedParents: MIC_ALLOWED_PARENTS,
  defaultProps: { name: '', description: '', capacity: '', employees: '' },
  defaultStyles: { desktop: { width: '100%', paddingTop: '16px', paddingBottom: '16px' } },
  renderer: CompanyRenderer,
  inspector: CompanyInspector,
})
