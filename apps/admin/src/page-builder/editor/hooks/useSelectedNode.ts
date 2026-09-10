import { useEditorStore } from '../store/editorStore'
import { findNode, pathTo } from '../core/tree'
import type { EditorNode } from '../core/types'

export function useSelectedNode(): EditorNode | null {
  const page = useEditorStore((state) => state.page)
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId)
  if (!selectedNodeId) return null
  return findNode(page.root, selectedNodeId)
}

/** Root → … → selected. Powers the canvas breadcrumb. */
export function useSelectionPath(): EditorNode[] {
  const page = useEditorStore((state) => state.page)
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId)
  if (!selectedNodeId) return []
  return pathTo(page.root, selectedNodeId)
}
