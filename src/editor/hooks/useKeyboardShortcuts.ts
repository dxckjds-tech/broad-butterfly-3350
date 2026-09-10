import { useEffect } from 'react'
import { useEditorStore } from '../store/editorStore'

/** Editor-level shortcuts. Ignored while typing in a form control. */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || document.querySelector('[data-editor-dragging="true"]')) return
      const target = event.target as HTMLElement | null
      const tag = target?.tagName ?? ''
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return
      }

      const store = useEditorStore.getState()
      const meta = event.metaKey || event.ctrlKey

      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) store.redo()
        else store.undo()
        return
      }
      if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault()
        store.save()
        return
      }
      if (meta && event.key.toLowerCase() === 'd') {
        if (!store.selectedNodeId) return
        event.preventDefault()
        store.dispatch({ type: 'DUPLICATE_NODE', nodeId: store.selectedNodeId })
        return
      }
      if (event.key === 'Escape') {
        if (store.preview) store.setPreview(false)
        else store.dispatch({ type: 'SELECT_NODE', nodeId: null })
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!store.selectedNodeId || store.selectedNodeId === store.page.root.id) return
        event.preventDefault()
        store.dispatch({ type: 'DELETE_NODE', nodeId: store.selectedNodeId })
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
