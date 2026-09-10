import { expect, it } from 'vitest'
import { keyboardDropPlans, stepKeyboardPlan } from '../keyboardDropPlan'
import { makePage } from '../../core/__tests__/fixtures'
import { applyCommand } from '../../core/reducer'
import { findNode } from '../../core/tree'

it('enumerates only effective legal moves in document order', () => {
  const page = makePage()
  const plans = keyboardDropPlans(page.root, 'heading', 'heading-1')
  expect(plans.map(p => [p.parentId, p.index])).toEqual([
    ['section-1', 2], ['section-2', 0], ['container-1', 0], ['section-2', 1],
  ])
  for (const plan of plans) {
    const next = applyCommand(page, { type: 'MOVE_NODE', nodeId: 'heading-1', parentId: plan.parentId, index: plan.index })
    expect(next).not.toBe(page)
    expect(findNode(next.root, plan.parentId)?.children?.some(n => n.id === 'heading-1')).toBe(true)
  }
})
it('never offers destinations inside the moving subtree', () => {
  const plans = keyboardDropPlans(makePage().root, 'section', 'section-2')
  expect(plans.some(p => ['section-2', 'container-1'].includes(p.parentId))).toBe(false)
})
it('rejects invalid moving nodes and root movement', () => {
  const root = makePage().root
  expect(keyboardDropPlans(root, 'heading', 'missing')).toEqual([])
  expect(keyboardDropPlans(root, 'heading', 'text-1')).toEqual([])
  expect(keyboardDropPlans(root, 'root', root.id)).toEqual([])
})
it('supports palette additions and an empty page root', () => {
  const page = makePage()
  page.root.children = []
  expect(keyboardDropPlans(page.root, 'section', null)).toEqual([{parentId: page.root.id, index: 0, overId: page.root.id, position: 'inside'}])
  expect(keyboardDropPlans(page.root, 'heading', null)).toEqual([])
})
it('steps both directions and stops at the boundaries', () => {
  const plans = keyboardDropPlans(makePage().root, 'heading', 'heading-1')
  expect(stepKeyboardPlan(plans, null, 1)).toBe(plans[0])
  expect(stepKeyboardPlan(plans, null, -1)).toBe(plans.at(-1))
  expect(stepKeyboardPlan(plans, plans[0]!, -1)).toBe(plans[0])
  expect(stepKeyboardPlan(plans, plans[0]!, 1)).toBe(plans[1])
  expect(stepKeyboardPlan(plans, plans.at(-1)!, 1)).toBe(plans.at(-1))
  expect(stepKeyboardPlan([], null, 1)).toBeNull()
})
