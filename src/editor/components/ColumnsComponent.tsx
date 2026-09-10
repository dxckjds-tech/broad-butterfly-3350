import { Columns3 } from 'lucide-react'
import { createNode, registerComponent } from '../core/registry'
import type { RendererProps } from '../core/registry'
import { EmptySlot } from './shared/EmptySlot'

function ColumnsRenderer({ node, chrome, children, preview }: RendererProps) {
  const empty = (node.children ?? []).length === 0
  return (
    <div {...chrome}>
      {empty && !preview ? <EmptySlot label="Empty columns row" /> : children}
    </div>
  )
}

registerComponent({
  type: 'columns',
  label: 'Columns',
  icon: Columns3,
  category: 'layout',
  description: 'Row of equal-width columns that stacks on mobile',
  acceptsChildren: true,
  // A columns row is a flex row of column boxes; anything else goes inside
  // one of those boxes, not beside them.
  allowedChildren: ['container'],
  defaultProps: {},
  defaultStyles: {
    desktop: { display: 'flex', flexDirection: 'row', gap: '24px', width: '100%' },
    mobile: { flexDirection: 'column', gap: '16px' },
  },
  defaultChildren: () => [
    createNode('container', { styles: { desktop: { flex: '1 1 0%', display: 'flex', flexDirection: 'column', gap: '12px' } } }),
    createNode('container', { styles: { desktop: { flex: '1 1 0%', display: 'flex', flexDirection: 'column', gap: '12px' } } }),
  ],
  renderer: ColumnsRenderer,
})
