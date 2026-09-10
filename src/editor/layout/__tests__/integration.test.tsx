import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EditorShell } from '../EditorShell'
import { useEditorStore } from '../../store/editorStore'
import { makePage } from '../../core/__tests__/fixtures'
import { findNode } from '../../core/tree'
import { loadPageDocument } from '../../store/persistence'

const store = () => useEditorStore.getState()
beforeEach(() => {
  // jsdom has no layout observer; keep real React, DnD, store and persistence.
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  localStorage.clear()
  store().replacePage(makePage())
  useEditorStore.setState({ preview: false, device: 'desktop', dirty: false, notice: null, recovery: null, savedAt: null })
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('renames across slow typing as one undo step, then saves the redone document', () => {
  vi.useFakeTimers()
  render(<EditorShell />)
  const input = screen.getByRole('textbox', { name: 'Page name' })
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'New' } })
  vi.setSystemTime(Date.now() + 2000)
  fireEvent.change(input, { target: { value: 'New page' } })
  fireEvent.blur(input)
  expect(store().history).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
  expect((input as HTMLInputElement).value).toBe('Test page')
  fireEvent.click(screen.getByRole('button', { name: /Redo/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  const saved = loadPageDocument()
  expect(saved.status).toBe('loaded')
  if (saved.status === 'loaded') expect(saved.page.name).toBe('New page')
  expect(screen.getByRole('status', { name: 'Editor notice' }).textContent).toBe('Saved')
})

it('canvas selection drives inspector edits and undo updates the rendered content', () => {
  const { container } = render(<EditorShell />)
  fireEvent.click(container.querySelector('[data-node-id="heading-1"]')!)
  expect(store().selectedNodeId).toBe('heading-1')
  const input = screen.getByPlaceholderText('Heading text')
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'Edited heading' } })
  fireEvent.blur(input)
  expect(container.querySelector('[data-node-id="heading-1"]')?.textContent).toBe('Edited heading')
  fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
  expect(findNode(store().page.root, 'heading-1')?.props['text']).not.toBe('Edited heading')
})

it('layers collapse and delete work with undo, and tab arrow keys move focus', () => {
  render(<EditorShell />)
  const build = screen.getByRole('tab', { name: 'Build' })
  fireEvent.keyDown(build, { key: 'ArrowRight' })
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Layers' }))
  const collapse = screen.getAllByRole('button', { name: 'Collapse' })[0]!
  fireEvent.click(collapse)
  expect(screen.getByRole('button', { name: 'Expand' }).getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(screen.getByRole('button', { name: 'Expand' }))
  fireEvent.click(screen.getByRole('button', { name: 'Delete Heading' }))
  expect(findNode(store().page.root, 'heading-1')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
  expect(findNode(store().page.root, 'heading-1')).not.toBeNull()
})

it('device and preview controls change view state without history entries', () => {
  render(<EditorShell />)
  fireEvent.click(screen.getByRole('button', { name: 'mobile' }))
  expect(store().device).toBe('mobile')
  expect(screen.getByRole('button', { name: 'mobile' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: /Preview/ }))
  expect(screen.queryByRole('tab', { name: 'Build' })).toBeNull()
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(store().preview).toBe(false)
  expect(store().history).toHaveLength(1)
})


async function key(element: Element, code: string) {
  fireEvent.keyDown(element, { code, key: code === 'Space' ? ' ' : code })
  // KeyboardSensor installs its document listener on the next task.
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
}

it('keyboard canvas drag reorders, commits once and can be undone', async () => {
  const { container } = render(<EditorShell />)
  const heading = container.querySelector('[data-node-id="heading-1"]')!
  await key(heading, 'Space')
  await key(heading, 'ArrowDown')
  expect(container.querySelector('[data-drop-indicator]')).not.toBeNull()
  await key(heading, 'Enter')
  expect(findNode(store().page.root, 'section-1')?.children?.map(n => n.id)).toEqual(['text-1', 'heading-1'])
  expect(store().history).toHaveLength(2)
  expect(container.querySelector('[data-drop-indicator]')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
  expect(findNode(store().page.root, 'section-1')?.children?.[0]?.id).toBe('heading-1')
})

it('keyboard cancel keeps document and selection and prevents editing shortcuts during drag', async () => {
  const { container } = render(<EditorShell />)
  const heading = container.querySelector('[data-node-id="heading-1"]')!
  fireEvent.click(heading)
  const original = store().page
  await key(heading, 'Space')
  await key(heading, 'ArrowDown')
  await key(heading, 'Delete')
  expect(store().page).toBe(original)
  await key(heading, 'Escape')
  expect(store().page).toBe(original)
  expect(store().selectedNodeId).toBe('heading-1')
  expect(container.querySelector('[data-drop-indicator]')).toBeNull()
})

it('palette keyboard drag inserts exactly once', async () => {
  render(<EditorShell />)
  const palette = screen.getByRole('button', { name: 'Section' })
  await key(palette, 'Space')
  await key(palette, 'ArrowDown')
  await key(palette, 'Space')
  expect(store().page.root.children).toHaveLength(3)
  expect(store().history).toHaveLength(2)
})

it('layer keyboard drag shares command history and can reparent', async () => {
  render(<EditorShell />)
  fireEvent.click(screen.getByRole('tab', { name: 'Layers' }))
  const layer = screen.getAllByRole('button', { name: 'Your headline goes here' })
    .find(element => !element.hasAttribute('data-node-id'))!
  await key(layer, 'Space')
  await key(layer, 'ArrowDown')
  await key(layer, 'ArrowDown')
  await key(layer, 'Enter')
  expect(findNode(store().page.root, 'section-2')?.children?.[0]?.id).toBe('heading-1')
  expect(store().history).toHaveLength(2)
})
