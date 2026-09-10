import { Layers } from 'lucide-react'
import { registerComponent } from '../core/registry'
import type { RendererProps } from '../core/registry'
import { ROOT_TYPE } from '../core/types'

/** The page root. Not selectable from the palette; always the drop fallback. */
function RootRenderer({ chrome, children }: RendererProps) {
  return <div {...chrome}>{children}</div>
}

registerComponent({
  type: ROOT_TYPE,
  label: 'Page',
  icon: Layers,
  category: 'layout',
  hidden: true,
  acceptsChildren: true,
  // The page root holds layout blocks only — text and buttons belong inside
  // a Section or Container so they inherit its width and padding.
  allowedChildren: ['section', 'container', 'columns'],
  defaultProps: {},
  defaultStyles: { desktop: { backgroundColor: '#ffffff', minHeight: '100%' } },
  renderer: RootRenderer,
})
