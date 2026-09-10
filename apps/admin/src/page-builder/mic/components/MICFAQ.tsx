/**
 * MIC FAQ accordion. All items start collapsed to keep the page short.
 */
import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { registerComponent } from '../../editor/core/registry'
import type { InspectorProps, RendererProps } from '../../editor/core/registry'
import { FieldRow } from '../../editor/inspector/controls/FieldRow'
import { TextArea } from '../../editor/inspector/controls/inputs'
import { cn } from '../../utils/cn'
import { MIC_ALLOWED_PARENTS } from './types'
import { MicEmpty, MicFrame, MicSectionTitle } from './shared'
import { readFaqList } from './readProps'
import type { FaqItem } from './readProps'

export interface FAQProps {
  faq: FaqItem[]
}

export function MICFAQ({ faq }: FAQProps) {
  const items = faq ?? []
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set())

  const toggle = (index: number) => {
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  return (
    <MicFrame testId="mic-faq">
      <MicSectionTitle>FAQ</MicSectionTitle>
      {items.length === 0 ? (
        <MicEmpty>No frequently asked questions</MicEmpty>
      ) : (
        <div className="divide-y divide-slate-200 rounded-md border border-slate-200">
          {items.map((item, index) => {
            const expanded = open.has(index)
            const question = item.question.trim() === '' ? `Question ${index + 1}` : item.question
            return (
              <div key={`${item.question}-${index}`}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 bg-white px-3 py-2.5 text-left text-[13px] font-medium text-slate-800"
                  aria-expanded={expanded}
                  aria-label={question}
                  onClick={() => toggle(index)}
                >
                  <span>{question}</span>
                  <span className="text-slate-400" aria-hidden="true">
                    {expanded ? '−' : '+'}
                  </span>
                </button>
                {expanded ? (
                  <p className="m-0 bg-slate-50 px-3 py-2 text-[13px] leading-relaxed text-slate-600">
                    {item.answer.trim() === '' ? '—' : item.answer}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </MicFrame>
  )
}

function FaqRenderer({ node, chrome }: RendererProps) {
  return (
    <section {...chrome} className={cn(chrome.className)}>
      <MICFAQ faq={readFaqList(node.props['faq'])} />
    </section>
  )
}

function FaqInspector({ node, updateProps }: InspectorProps) {
  const items = readFaqList(node.props['faq'])
  return (
    <FieldRow label="FAQ" stacked hint="One per line: question || answer">
      <TextArea
        rows={8}
        value={items.map((item) => `${item.question} || ${item.answer}`).join('\n')}
        placeholder="Is it OEM? || Yes, MOQ 100."
        onChange={(value) =>
          updateProps({
            faq: value
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line.length > 0)
              .map((line) => {
                const [question, ...rest] = line.split('||')
                return { question: (question ?? '').trim(), answer: rest.join('||').trim() }
              }),
          })
        }
      />
    </FieldRow>
  )
}

registerComponent({
  type: 'mic-faq',
  label: 'MIC FAQ',
  icon: HelpCircle,
  category: 'basic',
  description: 'Collapsible MIC FAQ (starts closed)',
  acceptsChildren: false,
  allowedParents: MIC_ALLOWED_PARENTS,
  defaultProps: { faq: [] },
  defaultStyles: { desktop: { width: '100%', paddingTop: '16px', paddingBottom: '16px' } },
  renderer: FaqRenderer,
  inspector: FaqInspector,
})
