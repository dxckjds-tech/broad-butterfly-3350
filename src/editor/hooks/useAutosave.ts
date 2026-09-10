import { useEffect } from 'react'
import { AUTOSAVE_DEBOUNCE_MS } from '../core/limits'
import { useEditorStore } from '../store/editorStore'

/**
 * Debounced autosave.
 *
 * The timer restarts on every document change, so a burst of edits writes
 * once when it settles. The write goes to the draft slot and touches no
 * history state — see `autosave` in the store.
 */
export function useAutosave(): void {
  const dirty = useEditorStore((state) => state.dirty)
  const page = useEditorStore((state) => state.page)
  const autosave = useEditorStore((state) => state.autosave)

  useEffect(() => {
    if (!dirty) return
    const timer = window.setTimeout(autosave, AUTOSAVE_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [dirty, page, autosave])

  // A tab can be closed or backgrounded mid-debounce; flush what is
  // pending so the draft is at most one gesture behind.
  useEffect(() => {
    const flush = () => {
      const state = useEditorStore.getState()
      if (state.dirty) state.autosave()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])
}
