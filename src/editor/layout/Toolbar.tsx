import { Eye, Monitor, Pencil, Redo2, Rocket, Save, Smartphone, Tablet, Undo2 } from 'lucide-react'
import { useEditTransaction } from '../hooks/useEditTransaction'
import { DEVICES } from '../core/types'
import type { Device } from '../core/types'
import { selectCanRedo, selectCanUndo, useEditorStore } from '../store/editorStore'
import { IconButton } from '../ui/IconButton'
import type { IconComponent } from '../core/registry'
import { cn } from '../../utils/cn'

const DEVICE_ICONS: Record<Device, IconComponent> = {
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone,
}

export function Toolbar() {
  const { onEditStart, onEditEnd } = useEditTransaction('page-name')
  const device = useEditorStore((state) => state.device)
  const setDevice = useEditorStore((state) => state.setDevice)
  const preview = useEditorStore((state) => state.preview)
  const togglePreview = useEditorStore((state) => state.togglePreview)
  const pageName = useEditorStore((state) => state.page.name)
  const renamePage = useEditorStore((state) => state.renamePage)
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const save = useEditorStore((state) => state.save)
  const canUndo = useEditorStore(selectCanUndo)
  const canRedo = useEditorStore(selectCanRedo)
  const notice = useEditorStore((state) => state.notice)

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-shell-border bg-white px-3">
      <div className="flex shrink-0 items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-[11px] font-bold text-white">
          AS
        </span>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-slate-800">AI Store Doctor</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Page Builder</div>
        </div>
      </div>

      <div className="h-6 w-px bg-shell-border" />

      <label className="flex min-w-0 items-center gap-1.5">
        <Pencil size={12} className="shrink-0 text-slate-400" />
        <input
          value={pageName}
          onFocus={onEditStart}
          onBlur={onEditEnd}
          onChange={(event) => renamePage(event.target.value)}
          aria-label="Page name"
          className="w-40 min-w-0 rounded border border-transparent bg-transparent px-1 py-0.5 text-[13px] text-slate-700 outline-none hover:border-slate-200 focus:border-brand-500 focus:bg-white"
        />
      </label>

      <SaveStatus />

      <div className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
          {DEVICES.map((entry) => {
            const Icon = DEVICE_ICONS[entry]
            const active = entry === device
            return (
              <button
                key={entry}
                type="button"
                title={entry}
                aria-label={entry}
                aria-pressed={active}
                onClick={() => setDevice(entry)}
                className={cn(
                  'inline-flex h-7 w-8 items-center justify-center rounded-md transition-colors',
                  active
                    ? 'bg-white text-brand-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800',
                )}
              >
                <Icon size={15} />
              </button>
            )
          })}
        </div>
      </div>

      {notice ? (
        <span role="status" aria-label="Editor notice" className="max-w-[240px] truncate text-[11px] text-slate-500" title={notice}>
          {notice}
        </span>
      ) : null}

      <div className="flex shrink-0 items-center gap-0.5">
        <IconButton label="Undo (⌘Z)" onClick={undo} disabled={!canUndo}>
          <Undo2 size={16} />
        </IconButton>
        <IconButton label="Redo (⇧⌘Z)" onClick={redo} disabled={!canRedo}>
          <Redo2 size={16} />
        </IconButton>
        <IconButton label="Preview (Esc to exit)" onClick={togglePreview} active={preview}>
          <Eye size={16} />
        </IconButton>
      </div>

      <div className="h-6 w-px bg-shell-border" />

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={save}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          <Save size={14} />
          Save
        </button>
        <button
          type="button"
          disabled
          title="Publishing arrives in phase 2"
          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md bg-brand-600 px-2.5 py-1.5 text-[12px] font-medium text-white opacity-60"
        >
          <Rocket size={14} />
          Publish
        </button>
      </div>
    </header>
  )
}

/** Dirty / last-saved indicator. Autosave is distinguished from a manual save
 * so "Saved" always means the committed document, not the recovery draft. */
function SaveStatus() {
  const dirty = useEditorStore((state) => state.dirty)
  const savedAt = useEditorStore((state) => state.savedAt)
  const byAutosave = useEditorStore((state) => state.savedByAutosave)

  const stamp = savedAt === null ? null : new Date(savedAt)
  const clock =
    stamp === null || Number.isNaN(stamp.getTime())
      ? null
      : stamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const label = dirty
    ? clock === null
      ? 'Unsaved changes'
      : `${byAutosave ? 'Autosaved' : 'Saved'} ${clock} · editing`
    : clock === null
      ? 'Not saved yet'
      : `Saved ${clock}`

  return (
    <span
      title={dirty ? 'Unsaved changes — autosave keeps a recoverable draft' : 'All changes saved'}
      className="flex shrink-0 items-center gap-1.5 text-[11px] text-slate-400"
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', dirty ? 'bg-amber-500' : 'bg-emerald-500')}
      />
      <span className="tabular-nums">{label}</span>
    </span>
  )
}
