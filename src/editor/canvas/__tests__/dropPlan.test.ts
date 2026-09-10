import { describe, expect, it } from 'vitest'
import { computeDropPlan, DROP_PREFIX } from '../dropPlan'
import type { DropPlanInput } from '../dropPlan'
import { makeNode, makePage } from '../../core/__tests__/fixtures'
import { getComponent, registerComponent } from '../../core/registry'
import { applyCommand } from '../../core/reducer'
import { findNode } from '../../core/tree'

const rect = { top: 0, left: 0, width: 100, height: 100 }
function plan(patch: Partial<DropPlanInput> = {}) {
  return computeDropPlan({ root: makePage().root, activeType: 'heading', activeId: null,
    overId: 'heading-1', overRect: rect, pointer: { x: 50, y: 25 }, ...patch })
}

describe('drop plans', () => {
  it.each([[25, 'before', 0], [75, 'after', 1]] as const)('leaf at y=%s resolves %s', (y, position, index) => {
    expect(plan({ pointer: { x: 50, y } })).toEqual({ parentId: 'section-1', overId: 'heading-1', position, index })
  })
  it('uses horizontal sibling geometry', () => {
    expect(plan({ pointer: { x: 75, y: 25 }, isHorizontal: () => true })?.position).toBe('after')
  })
  it('prefers inside a container body', () => {
    expect(plan({ overId: 'section-1' })).toEqual({ parentId: 'section-1', overId: 'section-1', position: 'inside', index: 0 })
  })
  it('appends in the lower container body', () => {
    expect(plan({ overId: 'section-1', pointer: { x: 50, y: 75 } })?.index).toBe(2)
  })
  it('prefers beside on a container edge', () => {
    expect(plan({ activeType: 'section', overId: 'section-1', pointer: { x: 50, y: 1 } })?.position).toBe('before')
  })
  it('walks past multiple incompatible ancestors and applies the indicated insertion', () => {
    const base = getComponent('container')!
    registerComponent({ ...base, type: 'restricted', allowedChildren: ['restricted', 'heading'] })
    const page = makePage()
    page.root.children = [makeNode('section', 'outer', [makeNode('restricted', 'a', [makeNode('restricted', 'b', [makeNode('heading', 'leaf')])])])]
    const target = plan({ root: page.root, activeType: 'text', overId: 'leaf' })!
    expect(target).toEqual({ parentId: 'outer', overId: 'a', position: 'before', index: 0 })
    const next = applyCommand(page, { type: 'ADD_NODE', parentId: target.parentId, index: target.index, node: makeNode('text', 'inserted') })
    expect(findNode(next.root, 'outer')?.children?.map(n => n.id)).toEqual(['inserted', 'a'])
    expect(plan({ root: page.root, activeType: 'text', overId: 'leaf', pointer: { x: 50, y: 75 } })).toEqual({ ...target, position: 'after', index: 1 })
  })
  it('root fallback accepts layouts and refuses basic nodes', () => {
    const root = makePage().root
    expect(plan({ root, overId: DROP_PREFIX + root.id, activeType: 'section' })?.parentId).toBe(root.id)
    expect(plan({ root, overId: DROP_PREFIX + root.id })).toBeNull()
  })
  it.each(['missing', 'drop:missing'])('ignores unknown targets %s', overId => expect(plan({ overId })).toBeNull())
  it('refuses unknown types and missing active nodes', () => {
    expect(plan({ activeType: 'unknown' })).toBeNull()
    expect(plan({ activeId: 'missing' })).toBeNull()
  })
  it('refuses self and descendant drops, including prefixed targets', () => {
    expect(plan({ activeId: 'heading-1' })).toBeNull()
    expect(plan({ activeId: 'section-1', activeType: 'section' })).toBeNull()
    expect(plan({ activeId: 'section-1', activeType: 'section', overId: 'drop:section-1' })).toBeNull()
  })
  it('returns pre-removal indices for same-parent moves', () => {
    const page = makePage()
    const target = plan({ root: page.root, activeId: 'heading-1', overId: 'text-1', pointer: { x: 50, y: 75 } })!
    expect(target.index).toBe(2)
    const next = applyCommand(page, { type: 'MOVE_NODE', nodeId: 'heading-1', parentId: target.parentId, index: target.index })
    expect(findNode(next.root, 'section-1')?.children?.map(n => n.id)).toEqual(['text-1', 'heading-1'])
  })
  it('has deterministic placement without pointer geometry', () => {
    expect(plan({ pointer: null, overRect: null })?.position).toBe('before')
  })
})
