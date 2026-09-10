/**
 * Shared presentational bits for MIC components.
 * No store, no schema writes, no AI calls.
 */
import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

export function MicPlaceholder({ label }: { label: string }) {
  return (
    <div
      className="flex aspect-[4/3] w-full items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 text-center text-[11px] text-slate-400"
      data-testid="mic-placeholder"
    >
      {label}
    </div>
  )
}

export function MicSectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="m-0 text-[18px] font-semibold tracking-tight text-slate-900">{children}</h2>
}

export function MicFrame({
  className,
  testId,
  children,
}: {
  className?: string
  testId?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex w-full flex-col gap-3', className)} data-testid={testId}>
      {children}
    </div>
  )
}

export function MicEmpty({ children }: { children: ReactNode }) {
  return <p className="m-0 text-[13px] text-slate-500">{children}</p>
}
