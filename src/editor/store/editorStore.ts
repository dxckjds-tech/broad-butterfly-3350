import { create } from 'zustand'
import { applyCommand } from '../core/reducer'
import { isHistoryCommand, isStructuralCommand, mergeKeyOf } from '../core/commands'
import type { Command } from '../core/commands'
import { HISTORY_LIMIT, HISTORY_MERGE_WINDOW_MS } from '../core/limits'
import { findParent } from '../core/tree'
import type { Device, EditorNode, PageDocument } from '../core/types'
import { createEmptyPage } from './defaultPage'
import {
  clearDraft,
  clearPageDocument,
  loadDraft,
  loadPageDocument,
  saveDraft,
  savePageDocument,
} from './persistence'
import type { DraftEnvelope } from './persistence'

export interface EditorState {
  // ---- document ----
  page: PageDocument
  // ---- selection / hover ----
  selectedNodeId: string | null
  hoveredNodeId: string | null
  // ---- view ----
  device: Device
  preview: boolean
  // ---- history ----
  history: PageDocument[]
  historyIndex: number
  /**
   * Merge bookkeeping. `mergeKey` identifies the edit that produced the
   * current top entry; `mergeAt` is when it last grew. `transaction` holds an
   * explicit begin/commit key, which overrides both the per-command key and
   * the time window.
   */
  mergeKey: string | null
  mergeAt: number
  transaction: string | null
  dirty: boolean
  /** ISO timestamp of the last successful write, autosave or manual. */
  savedAt: string | null
  /** True when the last write came from autosave rather than the Save button. */
  savedByAutosave: boolean
  /**
   * A draft newer than the committed document, found at boot. Held aside —
   * never applied automatically — so the user decides after a crash.
   */
  recovery: DraftEnvelope | null
  /** Transient message for the toolbar (save confirmation, load error). */
  notice: string | null

  // ---- actions ----
  dispatch: (command: Command) => void
  /**
   * Open an explicit merge scope. Every mergeable command dispatched until
   * `commitTransaction` lands in a single history entry, regardless of how
   * long the user takes. Structural commands still break out.
   */
  beginTransaction: (label?: string) => void
  commitTransaction: () => void
  setDevice: (device: Device) => void
  setHoveredNode: (nodeId: string | null) => void
  setPreview: (preview: boolean) => void
  togglePreview: () => void
  undo: () => void
  redo: () => void
  save: () => void
  /**
   * Debounced background write. Deliberately touches no document or history
   * state — autosave must never appear in the undo stack.
   */
  autosave: () => void
  loadFromStorage: () => void
  restoreRecovery: () => void
  discardRecovery: () => void
  replacePage: (page: PageDocument) => void
  renamePage: (name: string) => void
  resetPage: () => void
  setNotice: (notice: string | null) => void
}

const initialPage = createEmptyPage()

/** Reset merge bookkeeping — anything that jumps the timeline uses this. */
const BREAK_MERGE = { mergeKey: null, mergeAt: 0, transaction: null } as const

let transactionCounter = 0

export const useEditorStore = create<EditorState>()((set, get) => ({
  page: initialPage,
  selectedNodeId: null,
  hoveredNodeId: null,
  device: 'desktop',
  preview: false,
  history: [initialPage],
  historyIndex: 0,
  mergeKey: null,
  mergeAt: 0,
  transaction: null,
  dirty: false,
  savedAt: null,
  savedByAutosave: false,
  recovery: null,
  notice: null,

  dispatch: (command) => {
    const state = get()

    if (command.type === 'SELECT_NODE') {
      set({ selectedNodeId: command.nodeId })
      return
    }

    const nextPage = applyCommand(state.page, command)

    // Selection follow-through: keep the user pointed at the right node.
    const selectionPatch = nextSelection(state, command, nextPage)

    if (nextPage === state.page) {
      if (selectionPatch) set(selectionPatch)
      return
    }

    const patch: Partial<EditorState> = { page: nextPage, dirty: true, ...selectionPatch }

    if (isHistoryCommand(command)) {
      const structural = isStructuralCommand(command)
      const now = Date.now()
      // Inside a transaction every mergeable command shares one key.
      const key = structural ? null : (state.transaction ?? mergeKeyOf(command))
      const withinWindow =
        state.transaction !== null || now - state.mergeAt <= HISTORY_MERGE_WINDOW_MS
      const canMerge =
        key !== null &&
        key === state.mergeKey &&
        withinWindow &&
        state.historyIndex === state.history.length - 1

      if (canMerge) {
        // Replace the top entry: undo still lands before the burst started.
        const history = state.history.slice(0, state.historyIndex + 1)
        history[history.length - 1] = nextPage
        patch.history = history
        patch.historyIndex = history.length - 1
        patch.mergeAt = now
      } else {
        const trimmed = state.history.slice(0, state.historyIndex + 1)
        trimmed.push(nextPage)
        const overflow = Math.max(0, trimmed.length - HISTORY_LIMIT)
        const history = overflow > 0 ? trimmed.slice(overflow) : trimmed
        patch.history = history
        patch.historyIndex = history.length - 1
        patch.mergeKey = key
        patch.mergeAt = now
      }

      // A structural command ends any open burst, including an explicit one.
      if (structural) {
        patch.mergeKey = null
        patch.transaction = null
      }
    }

    set(patch)
  },

  beginTransaction: (label) => {
    transactionCounter += 1
    set({ transaction: `tx:${transactionCounter}:${label ?? 'edit'}` })
  },

  commitTransaction: () => set({ transaction: null, mergeKey: null }),

  setDevice: (device) => set({ device }),
  setHoveredNode: (nodeId) => set({ hoveredNodeId: nodeId }),
  setPreview: (preview) =>
    set(preview ? { preview, selectedNodeId: null, hoveredNodeId: null } : { preview }),
  togglePreview: () => get().setPreview(!get().preview),

  undo: () => {
    const { history, historyIndex } = get()
    if (historyIndex <= 0) return
    const target = history[historyIndex - 1]
    if (!target) return
    set({ page: target, historyIndex: historyIndex - 1, dirty: true, ...BREAK_MERGE })
    pruneSelection(set, get)
  },

  redo: () => {
    const { history, historyIndex } = get()
    if (historyIndex >= history.length - 1) return
    const target = history[historyIndex + 1]
    if (!target) return
    set({ page: target, historyIndex: historyIndex + 1, dirty: true, ...BREAK_MERGE })
    pruneSelection(set, get)
  },

  save: () => {
    const savedAt = new Date().toISOString()
    // `updatedAt` is written into the stored copy only: putting it in state
    // would make `page` diverge from the history entry it came from.
    try {
      savePageDocument({ ...get().page, updatedAt: savedAt })
      // The committed document now matches the editor, so the recovery draft
      // is spent.
      clearDraft()
      set({ dirty: false, savedAt, savedByAutosave: false, notice: 'Saved' })
    } catch {
      set({ notice: 'Save failed — localStorage unavailable' })
    }
  },

  autosave: () => {
    const state = get()
    if (!state.dirty) return
    try {
      const savedAt = saveDraft({ ...state.page, updatedAt: new Date().toISOString() })
      set({ savedAt, savedByAutosave: true })
    } catch {
      // Quota exhaustion should not interrupt editing; the manual Save button
      // reports the failure loudly enough.
      set({ notice: 'Autosave failed — localStorage unavailable' })
    }
  },

  loadFromStorage: () => {
    const outcome = loadPageDocument()
    const draft = loadDraft()

    if (outcome.status === 'loaded') {
      get().replacePage(outcome.page)
      set({
        dirty: false,
        savedAt: outcome.page.updatedAt ?? null,
        savedByAutosave: false,
        notice: null,
        // Only offer the draft when it is genuinely newer than what was saved.
        recovery:
          draft.status === 'found' && isRecoverable(draft.draft.savedAt, outcome.page.updatedAt)
            ? draft.draft
            : null,
      })
      if (draft.status === 'invalid') clearDraft()
      return
    }

    if (outcome.status === 'invalid') {
      // Corrupt payload must never brick the editor — fall back to a blank page.
      clearPageDocument()
      set({ notice: `Stored page was invalid (${outcome.error}) — started a blank page` })
    }

    // No committed document: an autosaved draft is all there is to recover.
    if (draft.status === 'found') {
      set({ recovery: draft.draft })
    } else if (draft.status === 'invalid') {
      clearDraft()
    }
  },

  restoreRecovery: () => {
    const { recovery } = get()
    if (!recovery) return
    get().replacePage(recovery.page)
    set({ recovery: null, dirty: true, notice: 'Recovered unsaved changes' })
  },

  discardRecovery: () => {
    clearDraft()
    set({ recovery: null, notice: 'Discarded the recovered draft' })
  },

  replacePage: (page) =>
    set({
      page,
      history: [page],
      historyIndex: 0,
      selectedNodeId: null,
      hoveredNodeId: null,
      dirty: true,
      ...BREAK_MERGE,
    }),

  renamePage: (name) => get().dispatch({ type: 'UPDATE_PAGE_META', patch: { name } }),

  resetPage: () => {
    const page = createEmptyPage()
    get().replacePage(page)
    clearDraft()
    set({ dirty: false, savedAt: null, savedByAutosave: false, recovery: null, notice: 'New blank page' })
  },

  setNotice: (notice) => set({ notice }),
}))

/** Where selection should land after a structural command. */
function nextSelection(
  state: EditorState,
  command: Command,
  nextPage: PageDocument,
): Partial<EditorState> | null {
  switch (command.type) {
    case 'ADD_NODE':
      return nextPage === state.page ? null : { selectedNodeId: command.node.id }
    case 'DELETE_NODE': {
      if (state.selectedNodeId === null) return null
      const parent = findParent(state.page.root, command.nodeId)
      const stillThere = nextPage !== state.page
      if (!stillThere) return null
      return { selectedNodeId: parent ? parent.id : null, hoveredNodeId: null }
    }
    case 'DUPLICATE_NODE':
      return null
    default:
      return null
  }
}

/** After undo/redo the selected node may no longer exist. */
function pruneSelection(
  set: (patch: Partial<EditorState>) => void,
  get: () => EditorState,
): void {
  const { page, selectedNodeId } = get()
  if (!selectedNodeId) return
  if (!containsId(page.root, selectedNodeId)) set({ selectedNodeId: null, hoveredNodeId: null })
}

function containsId(node: EditorNode, id: string): boolean {
  if (node.id === id) return true
  return (node.children ?? []).some((child) => containsId(child, id))
}

// ---- selectors (stable references, safe to use directly in components) ----
export const selectCanUndo = (state: EditorState): boolean => state.historyIndex > 0
export const selectCanRedo = (state: EditorState): boolean =>
  state.historyIndex < state.history.length - 1

/**
 * Should a draft be offered against a saved document stamped `reference`?
 *
 * Equal timestamps count as recoverable: a manual save clears the draft, so
 * a draft that still exists was written after that save even when both land
 * in the same millisecond. Being over-eager costs a dismissible banner;
 * being under-eager silently discards the user's last edits.
 */
function isRecoverable(candidate: string, reference: string | undefined): boolean {
  if (!reference) return true
  const a = Date.parse(candidate)
  const b = Date.parse(reference)
  if (Number.isNaN(a) || Number.isNaN(b)) return true
  return a >= b
}
