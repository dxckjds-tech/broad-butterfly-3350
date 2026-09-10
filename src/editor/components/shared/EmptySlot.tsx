interface EmptySlotProps {
  label: string
}

/** Editor-only affordance shown inside a container that has no children. */
export function EmptySlot({ label }: EmptySlotProps) {
  return (
    <div className="pointer-events-none flex min-h-[64px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50/60 px-3 py-4 text-[11px] text-slate-400">
      {label}
    </div>
  )
}
