import { History, X } from 'lucide-react'
import { useEditorStore } from '../store/editorStore'

/**
 * Shown when boot finds an autosaved draft newer than the saved document —
 * i.e. the previous session ended without a save. Restoring is an explicit
 * choice: silently adopting a draft would be indistinguishable from losing
 * the document the user did save.
 */
export function RecoveryBanner() {
  const recovery = useEditorStore((state) => state.recovery)
  const restore = useEditorStore((state) => state.restoreRecovery)
  const discard = useEditorStore((state) => state.discardRecovery)

  if (!recovery) return null

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-900">
      <History className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1">
        Unsaved changes from{' '}
        <span className="font-medium">{formatTime(recovery.savedAt)}</span> were recovered from
        this browser.
      </span>
      <button
        type="button"
        onClick={restore}
        className="shrink-0 rounded border border-amber-300 bg-white px-2 py-0.5 font-medium text-amber-800 hover:bg-amber-100"
      >
        Restore
      </button>
      <button
        type="button"
        aria-label="Discard recovered draft"
        onClick={discard}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-amber-700 hover:bg-amber-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? 'an earlier session' : date.toLocaleString()
}
