/**
 * MIC certification list. Display-only: does not generate certificates.
 * Image slots are reserved next to each name; this field is high-risk.
 */
import { BadgeCheck } from 'lucide-react'
import { registerComponent } from '../../editor/core/registry'
import type { InspectorProps, RendererProps } from '../../editor/core/registry'
import { getStringArray } from '../../editor/core/props'
import { FieldRow } from '../../editor/inspector/controls/FieldRow'
import { cn } from '../../utils/cn'
import { MIC_ALLOWED_PARENTS } from './types'
import { MicEmpty, MicFrame, MicSectionTitle } from './shared'

export interface CertificationProps {
  certifications: string[]
}

export function MICCertification({ certifications }: CertificationProps) {
  const items = (certifications ?? []).filter((entry) => entry.trim() !== '')
  return (
    <MicFrame testId="mic-certification">
      <MicSectionTitle>Certifications</MicSectionTitle>
      {items.length === 0 ? (
        <MicEmpty>No certifications listed</MicEmpty>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
          {items.map((name) => (
            <li
              key={name}
              className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-2"
            >
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50 text-[10px] text-slate-400"
                data-testid="mic-cert-image-slot"
              >
                Image
              </div>
              <span className="text-[13px] font-medium text-slate-800">{name}</span>
            </li>
          ))}
        </ul>
      )}
    </MicFrame>
  )
}

function CertRenderer({ node, chrome }: RendererProps) {
  return (
    <section {...chrome} className={cn(chrome.className)}>
      <MICCertification certifications={getStringArray(node.props, 'certifications')} />
    </section>
  )
}

function CertInspector({ node }: InspectorProps) {
  const items = getStringArray(node.props, 'certifications')
  return (
    <FieldRow label="Certificates" stacked hint="High-risk field. Display only — not generated here.">
      <p className="m-0 text-[12px] leading-relaxed text-slate-600">
        {items.length === 0 ? 'None on this node.' : items.join(', ')}
      </p>
    </FieldRow>
  )
}

registerComponent({
  type: 'mic-certification',
  label: 'MIC Certs',
  icon: BadgeCheck,
  category: 'basic',
  description: 'MIC certification list (display only)',
  acceptsChildren: false,
  allowedParents: MIC_ALLOWED_PARENTS,
  defaultProps: { certifications: [] },
  defaultStyles: { desktop: { width: '100%', paddingTop: '16px', paddingBottom: '16px' } },
  renderer: CertRenderer,
  inspector: CertInspector,
})
