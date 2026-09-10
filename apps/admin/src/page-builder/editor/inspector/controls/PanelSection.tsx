import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '../../../utils/cn'

interface PanelSectionProps {
  title: string
  defaultOpen?: boolean
  children: ReactNode
  /** Rendered right of the title, e.g. an override indicator. */
  badge?: ReactNode
}

export function PanelSection({ title, defaultOpen = false, children, badge }: PanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-b border-shell-border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-800"
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <span className="flex-1">{title}</span>
        {badge}
      </button>
      <div className={cn('px-3 pb-3', open ? 'block' : 'hidden')}>{children}</div>
    </section>
  )
}
