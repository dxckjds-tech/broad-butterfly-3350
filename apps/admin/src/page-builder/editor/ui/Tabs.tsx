import { cn } from '../../utils/cn'

export interface TabItem<T extends string> {
  id: T
  label: string
}

interface TabsProps<T extends string> {
  items: readonly TabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function Tabs<T extends string>({ items, value, onChange, className }: TabsProps<T>) {
  return (
    <div role="tablist" className={cn('flex border-b border-shell-border bg-white', className)}>
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(event) => {
              const index = items.findIndex((tab) => tab.id === item.id)
              const next = event.key === 'ArrowRight' ? (index + 1) % items.length
                : event.key === 'ArrowLeft' ? (index - 1 + items.length) % items.length
                : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : -1
              const target = items[next]
              if (!target) return
              event.preventDefault()
              onChange(target.id)
              const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
              buttons?.[next]?.focus()
            }}
            onClick={() => onChange(item.id)}
            className={cn(
              'relative flex-1 px-3 py-2 text-[11px] font-medium uppercase tracking-wide transition-colors',
              active ? 'text-brand-600' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            {item.label}
            {active ? (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
