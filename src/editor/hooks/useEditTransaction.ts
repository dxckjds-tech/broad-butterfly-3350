import { useCallback } from 'react'
import { useEditorStore } from '../store/editorStore'

/**
 * Focus/blur (or pointer down/up) handlers that wrap a continuous edit in
 * one history entry.
 *
 * The store also merges by time window, which covers fast typing on its
 * own; an explicit transaction is what makes a *slow* edit — typing with
 * pauses, dragging a slider for ten seconds — still a single undo step.
 */
export function useEditTransaction(label?: string) {
  const begin = useEditorStore((state) => state.beginTransaction)
  const commit = useEditorStore((state) => state.commitTransaction)

  const onEditStart = useCallback(() => begin(label), [begin, label])
  const onEditEnd = useCallback(() => commit(), [commit])

  return { onEditStart, onEditEnd }
}
