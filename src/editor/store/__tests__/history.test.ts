import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HISTORY_MERGE_WINDOW_MS } from '../../core/limits'
import { findNode } from '../../core/tree'
import { useEditorStore } from '../editorStore'
import { makeNode, makePage } from '../../core/__tests__/fixtures'

/** Load the fixture as the document and start from a clean timeline. */
function seed() {
  const page = makePage()
  useEditorStore.setState({
    page,
    history: [page],
    historyIndex: 0,
    selectedNodeId: null,
    hoveredNodeId: null,
    mergeKey: null,
    mergeAt: 0,
    transaction: null,
    dirty: false,
    savedAt: null,
    savedByAutosave: false,
    recovery: null,
    notice: null,
  })
  return page
}

const store = () => useEditorStore.getState()
const headingText = () =>
  findNode(store().page.root, 'heading-1')?.props['text'] as string | undefined

beforeEach(() => {
  vi.useRealTimers()
  window.localStorage.clear()
  seed()
})

describe('undo / redo', () => {
  it('undo restores the previous document, redo re-applies it', () => {
    store().dispatch({ type: 'DELETE_NODE', nodeId: 'text-1' })
    expect(findNode(store().page.root, 'text-1')).toBeNull()

    store().undo()
    expect(findNode(store().page.root, 'text-1')).not.toBeNull()

    store().redo()
    expect(findNode(store().page.root, 'text-1')).toBeNull()
  })

  it('stops at the ends of the timeline', () => {
    const page = store().page
    store().undo()
    expect(store().page).toBe(page)
    store().redo()
    expect(store().page).toBe(page)
  })

  it('a no-op command adds no history entry', () => {
    const before = store().history.length
    // root cannot hold a heading — the reducer refuses.
    store().dispatch({ type: 'ADD_NODE', parentId: 'root', node: makeNode('heading', 'h-x') })
    expect(store().history).toHaveLength(before)
  })
})

describe('branching', () => {
  it('an edit after undo discards the redo tail', () => {
    store().dispatch({ type: 'DELETE_NODE', nodeId: 'text-1' })
    store().dispatch({ type: 'DELETE_NODE', nodeId: 'heading-1' })
    expect(store().history).toHaveLength(3)

    store().undo()
    store().dispatch({ type: 'DELETE_NODE', nodeId: 'section-2' })

    expect(store().historyIndex).toBe(store().history.length - 1)
    expect(store().history).toHaveLength(3)
    // The discarded branch is gone: redo cannot bring heading-1 back.
    store().redo()
    expect(findNode(store().page.root, 'heading-1')).not.toBeNull()
    expect(findNode(store().page.root, 'section-2')).toBeNull()
  })
})

describe('merged typing', () => {
  it('collapses a burst of prop edits into one undo step', () => {
    const before = store().history.length
    for (const text of ['H', 'He', 'Hel', 'Hell', 'Hello']) {
      store().dispatch({ type: 'UPDATE_PROPS', nodeId: 'heading-1', patch: { text } })
    }
    expect(headingText()).toBe('Hello')
    expect(store().history).toHaveLength(before + 1)

    store().undo()
    expect(headingText()).not.toBe('Hello')
    expect(headingText()).toBe(findNode(makePage().root, 'heading-1')?.props['text'])
  })

  it('starts a new entry once the merge window lapses', () => {
    vi.useFakeTimers()
    const before = store().history.length
    store().dispatch({ type: 'UPDATE_PROPS', nodeId: 'heading-1', patch: { text: 'A' } })
    vi.advanceTimersByTime(HISTORY_MERGE_WINDOW_MS + 50)
    store().dispatch({ type: 'UPDATE_PROPS', nodeId: 'heading-1', patch: { text: 'AB' } })
    expect(store().history).toHaveLength(before + 2)
    vi.useRealTimers()
  })

  it('does not merge edits to different nodes or different properties', () => {
    const before = store().history.length
    store().dispatch({ type: 'UPDATE_PROPS', nodeId: 'heading-1', patch: { text: 'A' } })
    store().dispatch({ type: 'UPDATE_PROPS', nodeId: 'text-1', patch: { text: 'B' } })
    expect(store().history).toHaveLength(before + 2)

    store().dispatch({
      type: 'UPDATE_STYLE',
      nodeId: 'heading-1',
      device: 'desktop',
      patch: { color: '#000000' },
    })
    expect(store().history).toHaveLength(before + 3)
  })

  it('a transaction merges across the time window and commits as one step', () => {
    vi.useFakeTimers()
    const before = store().history.length
    store().beginTransaction('type-title')
    store().dispatch({ type: 'UPDATE_PROPS', nodeId: 'heading-1', patch: { text: 'A' } })
    vi.advanceTimersByTime(HISTORY_MERGE_WINDOW_MS * 5)
    store().dispatch({ type: 'UPDATE_PROPS', nodeId: 'heading-1', patch: { text: 'AB' } })
    store().commitTransaction()
    expect(store().history).toHaveLength(before + 1)
    expect(store().transaction).toBeNull()

    // The next edit lands in its own entry.
    store().dispatch({ type: 'UPDATE_PROPS', nodeId: 'heading-1', patch: { text: 'ABC' } })
    expect(store().history).toHaveLength(before + 2)
    vi.useRealTimers()
  })
})

describe('structural isolation', () => {
  it('a structural command never merges, even inside a transaction', () => {
    const before = store().history.length
    store().beginTransaction('mixed')
    store().dispatch({ type: 'UPDATE_PROPS', nodeId: 'heading-1', patch: { text: 'A' } })
    store().dispatch({ type: 'DELETE_NODE', nodeId: 'text-1' })
    expect(store().history).toHaveLength(before + 2)
    // The delete closed the burst.
    expect(store().transaction).toBeNull()
    expect(store().mergeKey).toBeNull()

    // Undo peels the delete only.
    store().undo()
    expect(findNode(store().page.root, 'text-1')).not.toBeNull()
    expect(headingText()).toBe('A')
  })

  it('consecutive structural commands each get an entry', () => {
    const before = store().history.length
    store().dispatch({ type: 'DELETE_NODE', nodeId: 'text-1' })
    store().dispatch({ type: 'DELETE_NODE', nodeId: 'heading-1' })
    expect(store().history).toHaveLength(before + 2)
  })
})

describe('autosave and history', () => {
  it('autosave writes a draft without touching the timeline', () => {
    store().dispatch({ type: 'UPDATE_PROPS', nodeId: 'heading-1', patch: { text: 'A' } })
    const history = store().history
    const index = store().historyIndex
    const page = store().page

    store().autosave()
    expect(store().history).toBe(history)
    expect(store().historyIndex).toBe(index)
    expect(store().page).toBe(page)
    expect(store().savedAt).not.toBeNull()
    expect(store().savedByAutosave).toBe(true)
  })

  it('a manual save clears dirty and the recovered draft', () => {
    store().dispatch({ type: 'UPDATE_PROPS', nodeId: 'heading-1', patch: { text: 'A' } })
    store().autosave()
    store().save()
    expect(store().dirty).toBe(false)
    expect(store().savedByAutosave).toBe(false)

    // Booting again finds the saved document and nothing to recover.
    store().loadFromStorage()
    expect(store().recovery).toBeNull()
    expect(headingText()).toBe('A')
  })

  it('offers a newer draft for recovery and applies it only on request', () => {
    store().save()
    store().dispatch({ type: 'UPDATE_PROPS', nodeId: 'heading-1', patch: { text: 'unsaved' } })
    store().autosave()

    // Simulate a reload.
    seed()
    store().loadFromStorage()
    expect(store().recovery).not.toBeNull()
    expect(headingText()).not.toBe('unsaved')

    store().restoreRecovery()
    expect(headingText()).toBe('unsaved')
    expect(store().recovery).toBeNull()
  })

  it('discarding the draft leaves the saved document in place', () => {
    store().save()
    store().dispatch({ type: 'UPDATE_PROPS', nodeId: 'heading-1', patch: { text: 'unsaved' } })
    store().autosave()

    seed()
    store().loadFromStorage()
    store().discardRecovery()
    expect(store().recovery).toBeNull()

    seed()
    store().loadFromStorage()
    expect(store().recovery).toBeNull()
  })

  it('a corrupt stored document does not brick the editor', () => {
    window.localStorage.setItem('asd.page-builder.document.v1', '{ not json')
    store().loadFromStorage()
    expect(store().page.root.type).toBe('root')
    expect(store().notice).toMatch(/invalid/i)
  })
})

describe('page metadata commands', () => {
  it('renames through history, merges a typing burst and supports redo', () => {
    const original = store().page
    store().renamePage('A')
    store().renamePage('AB')
    expect(store().history).toHaveLength(2)
    expect(store().history[1]).toBe(store().page)
    expect(store().page.updatedAt).not.toBe(original.updatedAt)
    expect(store().page.root).toBe(original.root)
    store().undo()
    expect(store().page).toBe(original)
    store().redo()
    expect(store().page.name).toBe('AB')
  })
  it('skips unchanged and empty patches', () => {
    store().renamePage(store().page.name)
    store().dispatch({ type: 'UPDATE_PAGE_META', patch: {} })
    expect(store().history).toHaveLength(1)
    expect(store().dirty).toBe(false)
  })
  it('branches after undo without merging into the previous timeline', () => {
    store().renamePage('A')
    store().undo()
    store().renamePage('B')
    store().redo()
    expect(store().page.name).toBe('B')
    expect(store().history).toHaveLength(2)
  })
  it('separates metadata from content edits', () => {
    store().renamePage('A')
    store().dispatch({ type: 'UPDATE_PROPS', nodeId: 'heading-1', patch: { text: 'B' } })
    expect(store().history).toHaveLength(3)
    store().undo()
    expect(store().page.name).toBe('A')
  })
})
