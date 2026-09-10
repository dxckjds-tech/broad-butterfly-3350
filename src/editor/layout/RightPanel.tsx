import { Inspector } from '../inspector/Inspector'

export function RightPanel() {
  return (
    <aside className="flex w-[288px] shrink-0 flex-col border-l border-shell-border bg-white">
      <Inspector />
    </aside>
  )
}
