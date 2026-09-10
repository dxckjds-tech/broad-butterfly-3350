/**
 * MIC packaging and shipping copy.
 */
import { Package } from 'lucide-react'
import { registerComponent } from '../../editor/core/registry'
import type { InspectorProps, RendererProps } from '../../editor/core/registry'
import { getString } from '../../editor/core/props'
import { FieldRow } from '../../editor/inspector/controls/FieldRow'
import { TextArea } from '../../editor/inspector/controls/inputs'
import { cn } from '../../utils/cn'
import { MIC_ALLOWED_PARENTS } from './types'
import { MicEmpty, MicFrame, MicSectionTitle } from './shared'

export interface PackagingProps {
  description: string
  shipping: string
}

export function MICPackaging({ description, shipping }: PackagingProps) {
  const copy = (description ?? '').trim()
  const ship = (shipping ?? '').trim()
  return (
    <MicFrame testId="mic-packaging">
      <MicSectionTitle>Packaging & shipping</MicSectionTitle>
      {copy === '' && ship === '' ? (
        <MicEmpty>No packaging information</MicEmpty>
      ) : (
        <>
          {copy !== '' ? <p className="m-0 text-[14px] leading-relaxed text-slate-700">{copy}</p> : null}
          {ship !== '' ? (
            <p className="m-0 text-[13px] text-slate-600">
              <span className="font-medium text-slate-800">Shipping: </span>
              {ship}
            </p>
          ) : null}
        </>
      )}
    </MicFrame>
  )
}

function PackagingRenderer({ node, chrome }: RendererProps) {
  return (
    <section {...chrome} className={cn(chrome.className)}>
      <MICPackaging
        description={getString(node.props, 'description')}
        shipping={getString(node.props, 'shipping')}
      />
    </section>
  )
}

function PackagingInspector({ node, updateProps }: InspectorProps) {
  return (
    <>
      <FieldRow label="Packaging" stacked>
        <TextArea
          rows={4}
          value={getString(node.props, 'description')}
          placeholder="Export carton, 20 pcs/carton"
          onChange={(value) => updateProps({ description: value })}
        />
      </FieldRow>
      <FieldRow label="Shipping" stacked>
        <TextArea
          rows={3}
          value={getString(node.props, 'shipping')}
          placeholder="FOB Ningbo, 15 days"
          onChange={(value) => updateProps({ shipping: value })}
        />
      </FieldRow>
    </>
  )
}

registerComponent({
  type: 'mic-packaging',
  label: 'MIC Packaging',
  icon: Package,
  category: 'basic',
  description: 'Packaging and shipping notes',
  acceptsChildren: false,
  allowedParents: MIC_ALLOWED_PARENTS,
  defaultProps: { description: '', shipping: '' },
  defaultStyles: { desktop: { width: '100%', paddingTop: '16px', paddingBottom: '16px' } },
  renderer: PackagingRenderer,
  inspector: PackagingInspector,
})
