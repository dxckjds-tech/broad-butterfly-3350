import { Box } from 'lucide-react'
import { registerComponent } from '../core/registry'
import type { RendererProps } from '../core/registry'
import { EmptySlot } from './shared/EmptySlot'

function ContainerRenderer({ node, chrome, children, preview }: RendererProps) {
  const empty = (node.children ?? []).length === 0
  return (
    <div {...chrome}>
      {empty && !preview ? <EmptySlot label="Empty container" /> : children}
    </div>
  )
}

registerComponent({
  type: 'container',
  label: 'Container',
  icon: Box,
  category: 'layout',
  description: 'Flex box for grouping and aligning elements',
  acceptsChildren: true,
  defaultProps: {},
  defaultStyles: {
    desktop: { display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' },
  },
  renderer: ContainerRenderer,
})
