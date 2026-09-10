/**
 * v0.3.0 Step 3 — suggestion preview UI, approval, and Template Center.
 *
 * These tests do not call an AI API. Suggestions stay PENDING until the
 * user clicks Accept. Canvas / History / Drag-drop internals are unused.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import '../src/editor/components'
import { EditorShell } from '../src/editor/layout/EditorShell'
import { SuggestionPanel } from '../src/ai/suggestion-ui/SuggestionPanel'
import { DiffViewer } from '../src/ai/suggestion-ui/DiffViewer'
import { RiskBadge } from '../src/ai/suggestion-ui/RiskBadge'
import { TemplateCenter } from '../src/mic/templates/ui/TemplateCenter'
import { createPatch } from '../src/ai/protocol/patch'
import { createSuggestion } from '../src/ai/protocol/suggestion'
import { parsePageDocument } from '../src/editor/core/schema'
import { emptyMICPageSchema } from '../src/mic/schema/page'
import { useEditorStore } from '../src/editor/store/editorStore'
import {
  applyWithoutApproval,
  confirmSuggestion,
  createPreviewSuggestions,
  declineSuggestion,
} from '../src/mic/services/suggestionService'
import {
  createBuilderPageFromTemplate,
  createMICPageFromTemplate,
  listMicTemplates,
} from '../src/mic/services/templateService'
import { MACHINERY_TEMPLATE_ID } from '../src/mic/templates/machinery'
import { convertMICPageToBuilder } from '../src/mic/adapters/micComponentAdapter'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..')

afterEach(() => {
  cleanup()
})

function titleSuggestion() {
  return createSuggestion({
    id: 'sug_title',
    title: '优化标题',
    description: 'Improve buyer search matching',
    risk: 'LOW',
    patches: [
      createPatch({
        action: 'UPDATE',
        target: 'product.productName',
        oldValue: 'Portable Vacuum',
        newValue: 'Cordless Handheld Vacuum Cleaner',
        source: 'AI_GENERATED',
      }),
    ],
  })
}

function actionSuggestion(
  id: string,
  action: 'UPDATE' | 'INSERT' | 'DELETE' | 'MOVE',
  target: string,
  oldValue: unknown,
  newValue: unknown,
) {
  return createSuggestion({
    id,
    title: `${action} ${target}`,
    description: `${action} preview`,
    risk: action === 'DELETE' ? 'MEDIUM' : 'LOW',
    patches: [createPatch({ action, target, oldValue, newValue, source: 'AI_GENERATED' })],
  })
}

describe('SuggestionPanel display', () => {
  it('renders the suggestion title, field, reason, and risk', () => {
    render(
      <SuggestionPanel suggestions={[titleSuggestion()]} onApprove={() => undefined} onReject={() => undefined} />,
    )
    expect(screen.getByText('优化标题')).toBeTruthy()
    expect(screen.getByText('product.productName')).toBeTruthy()
    expect(screen.getByText('原因：Improve buyer search matching')).toBeTruthy()
    expect(screen.getByTestId('risk-badge').textContent).toContain('LOW')
    expect(screen.getByTestId('risk-badge').textContent).toContain('普通优化')
    expect(screen.getByRole('button', { name: '接受' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '拒绝' })).toBeTruthy()
  })

  it('shows Before / After copy for an UPDATE', () => {
    render(
      <SuggestionPanel suggestions={[titleSuggestion()]} onApprove={() => undefined} onReject={() => undefined} />,
    )
    const diff = screen.getByTestId('diff-viewer')
    expect(diff.textContent).toContain('Before')
    expect(diff.textContent).toContain('Portable Vacuum')
    expect(diff.textContent).toContain('After')
    expect(diff.textContent).toContain('Cordless Handheld Vacuum Cleaner')
  })

  it('renders UPDATE, INSERT, DELETE, and MOVE cards', () => {
    const suggestions = [
      actionSuggestion('sug_u', 'UPDATE', 'product.productName', 'Old', 'New'),
      actionSuggestion('sug_i', 'INSERT', 'product.keywords', ['vacuum cleaner'], [
        'cordless vacuum cleaner',
        'handheld vacuum cleaner',
      ]),
      actionSuggestion('sug_d', 'DELETE', 'product.keywords.0', 'legacy', undefined),
      actionSuggestion('sug_m', 'MOVE', 'product.images', [{ id: 'a' }, { id: 'b' }], { from: 1, to: 0 }),
    ]
    render(<SuggestionPanel suggestions={suggestions} onApprove={() => undefined} onReject={() => undefined} />)
    expect(screen.getAllByTestId('suggestion-card')).toHaveLength(4)
    expect(document.querySelector('[data-patch-action="UPDATE"]')).toBeTruthy()
    expect(document.querySelector('[data-patch-action="INSERT"]')).toBeTruthy()
    expect(document.querySelector('[data-patch-action="DELETE"]')).toBeTruthy()
    expect(document.querySelector('[data-patch-action="MOVE"]')).toBeTruthy()
  })
})

describe('DiffViewer', () => {
  it('diffs string, array, and object values', () => {
    const { rerender } = render(<DiffViewer oldValue="Portable Vacuum" newValue="Cordless Handheld Vacuum Cleaner" />)
    expect(screen.getByText('Portable Vacuum')).toBeTruthy()
    expect(screen.getByText('Cordless Handheld Vacuum Cleaner')).toBeTruthy()

    rerender(
      <DiffViewer
        oldValue={['vacuum cleaner']}
        newValue={['cordless vacuum cleaner', 'handheld vacuum cleaner']}
      />,
    )
    expect(screen.getByText(/"vacuum cleaner"/)).toBeTruthy()
    expect(screen.getAllByText(/cordless vacuum cleaner/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Added:/)).toBeTruthy()

    rerender(<DiffViewer oldValue={{ name: 'A' }} newValue={{ name: 'B', extra: 1 }} />)
    expect(screen.getByText('name')).toBeTruthy()
    expect(screen.getByText('A')).toBeTruthy()
    expect(screen.getByText('B')).toBeTruthy()
  })
})

describe('RiskBadge uses theme tokens', () => {
  it('does not hard-code hex colours', () => {
    const { rerender } = render(<RiskBadge risk="LOW" />)
    expect(screen.getByTestId('risk-badge').className).toContain('bg-risk-low-soft')
    rerender(<RiskBadge risk="MEDIUM" />)
    expect(screen.getByTestId('risk-badge').className).toContain('text-risk-medium')
    rerender(<RiskBadge risk="HIGH" />)
    expect(screen.getByTestId('risk-badge').className).toContain('bg-risk-high-soft')
    expect(screen.getByTestId('risk-badge').textContent).toContain('必须确认')
  })
})

describe('approval flow', () => {
  it('approves PENDING → APPROVED and applies the patch', () => {
    const page = emptyMICPageSchema()
    page.product.productName = 'Portable Vacuum'
    const pending = createPreviewSuggestions(page)[0]!
    expect(pending.status).toBe('PENDING')
    const result = confirmSuggestion(page, pending)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.suggestion.status).toBe('APPROVED')
    expect(result.page.product.productName).toBe('Cordless Portable Vacuum')
  })

  it('rejects without mutating the MIC page', () => {
    const page = emptyMICPageSchema()
    page.product.productName = 'Portable Vacuum'
    const pending = createPreviewSuggestions(page)[0]!
    const result = declineSuggestion(page, pending)
    expect(result.ok).toBe(true)
    expect(result.suggestion.status).toBe('REJECTED')
    expect(result.page.product.productName).toBe('Portable Vacuum')
    expect(result.page).toBe(page)
  })

  it('panel Accept / Reject callbacks fire with the suggestion id', () => {
    const approved: string[] = []
    const rejected: string[] = []
    render(
      <SuggestionPanel
        suggestions={[titleSuggestion()]}
        onApprove={(id) => approved.push(id)}
        onReject={(id) => rejected.push(id)}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '接受' }))
    fireEvent.click(screen.getByRole('button', { name: '拒绝' }))
    expect(approved).toEqual(['sug_title'])
    expect(rejected).toEqual(['sug_title'])
  })
})

describe('Template Center', () => {
  it('lists Machinery, Electronic, and Consumer and reports the selected id', () => {
    const selected: string[] = []
    render(<TemplateCenter onSelect={(id) => selected.push(id)} />)
    expect(screen.getByText('Machinery')).toBeTruthy()
    expect(screen.getByText('Electronic')).toBeTruthy()
    expect(screen.getByText('Consumer')).toBeTruthy()
    expect(screen.getByText('适合：机械设备')).toBeTruthy()
    expect(screen.getAllByText('Hero').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Feature').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Specification').length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByTestId('mic-template-card')[0]!)
    expect(selected).toEqual([MACHINERY_TEMPLATE_ID])
  })

  it('builds a MIC page then a builder document from a template', () => {
    const created = createMICPageFromTemplate(MACHINERY_TEMPLATE_ID)
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(created.page.product.productName).toContain('CNC')
    const document = convertMICPageToBuilder(created.page)
    const parsed = parsePageDocument(document)
    expect(parsed.ok).toBe(true)
    const types = (document.root.children ?? []).flatMap((section) =>
      (section.children ?? []).map((child) => child.type),
    )
    expect(types).toContain('mic-product-hero')
    expect(types).toContain('mic-feature-section')
    expect(types).toContain('mic-specification-table')
    expect(createBuilderPageFromTemplate(MACHINERY_TEMPLATE_ID)?.name).toBe(created.page.product.productName)
    expect(listMicTemplates().map((entry) => entry.name)).toEqual(['Machinery', 'Electronic', 'Consumer'])
  })
})

describe('AI cannot auto-apply', () => {
  it('refuses applySuggestion while status is PENDING', () => {
    const page = emptyMICPageSchema()
    page.product.productName = 'Portable Vacuum'
    const pending = createPreviewSuggestions(page)[0]!
    expect(pending.status).toBe('PENDING')
    const blocked = applyWithoutApproval(page, pending)
    expect(blocked.ok).toBe(false)
    if (blocked.ok) return
    expect(blocked.error).toMatch(/PENDING/)
    expect(page.product.productName).toBe('Portable Vacuum')
  })

  it('preview suggestions are created as PENDING', () => {
    const list = createPreviewSuggestions(emptyMICPageSchema())
    expect(list.length).toBeGreaterThan(0)
    expect(list.every((entry) => entry.status === 'PENDING')).toBe(true)
    expect(list.every((entry) => entry.patches.every((patch) => patch.needConfirm))).toBe(true)
  })

  it('suggestion and template services do not import the editor store', () => {
    const suggestionSrc = readFileSync(join(repoRoot, 'src/mic/services/suggestionService.ts'), 'utf8')
    const templateSrc = readFileSync(join(repoRoot, 'src/mic/services/templateService.ts'), 'utf8')
    expect(suggestionSrc).not.toMatch(/useEditorStore|editorStore/)
    expect(templateSrc).not.toMatch(/useEditorStore|editorStore/)
  })
})

describe('EditorShell wiring', () => {
  const store = () => useEditorStore.getState()

  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    localStorage.clear()
    store().replacePage({
      id: 'page-test',
      name: 'Blank',
      schemaVersion: 1,
      root: { id: 'root', type: 'root', props: {}, styles: { desktop: {} }, children: [] },
      updatedAt: new Date().toISOString(),
    })
    useEditorStore.setState({
      preview: false,
      device: 'desktop',
      dirty: false,
      notice: null,
      recovery: null,
      savedAt: null,
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('applies a MIC template to the canvas, then Accept updates the page and Reject does not', () => {
    render(<EditorShell />)
    fireEvent.click(screen.getByRole('tab', { name: 'Templates' }))
    fireEvent.click(screen.getByRole('button', { name: /Machinery/ }))
    const hero = screen.getByTestId('mic-product-hero')
    expect(hero.textContent).toContain('CNC Vertical Machining Center VMC-850')
    expect(hero.textContent).not.toContain('Cordless CNC')

    const panel = screen.getByTestId('suggestion-panel')
    expect(panel).toBeTruthy()
    const titleCard = screen.getAllByTestId('suggestion-card')[0]!
    expect(titleCard.getAttribute('data-suggestion-id')).toBe('sug_preview_title')
    expect(titleCard.getAttribute('data-status')).toBe('PENDING')

    fireEvent.click(within(titleCard).getByRole('button', { name: '接受' }))
    expect(screen.getByTestId('mic-product-hero').textContent).toContain(
      'Cordless CNC Vertical Machining Center VMC-850',
    )
    expect(screen.getAllByTestId('suggestion-card')[0]!.getAttribute('data-status')).toBe('APPROVED')

    const keywordCard = screen.getAllByTestId('suggestion-card')[1]!
    const nameBeforeReject = store().page.name
    fireEvent.click(within(keywordCard).getByRole('button', { name: '拒绝' }))
    expect(screen.getAllByTestId('suggestion-card')[1]!.getAttribute('data-status')).toBe('REJECTED')
    expect(store().page.name).toBe(nameBeforeReject)
  })
})
