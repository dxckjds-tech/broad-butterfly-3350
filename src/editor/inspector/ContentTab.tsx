import { getComponent } from '../core/registry'
import type { Device, EditorNode, StyleValue } from '../core/types'

interface ContentTabProps {
  node: EditorNode
  device: Device
  updateProps: (patch: Record<string, unknown>) => void
  updateStyle: (patch: Record<string, StyleValue | null>) => void
}

export function ContentTab({ node, device, updateProps, updateStyle }: ContentTabProps) {
  const definition = getComponent(node.type)
  const Inspector = definition?.inspector

  if (!Inspector) {
    return (
      <p className="px-3 py-4 text-[11px] leading-relaxed text-slate-500">
        <span className="font-medium text-slate-700">{definition?.label ?? node.type}</span> has no
        content properties. Use the <span className="font-medium text-slate-700">Style</span> tab to
        change how it looks.
      </p>
    )
  }

  return (
    <div className="px-3 py-2">
      <Inspector node={node} device={device} updateProps={updateProps} updateStyle={updateStyle} />
    </div>
  )
}
