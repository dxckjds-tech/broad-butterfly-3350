import { describe, expect, it } from 'vitest'
import { applyCommand } from '../reducer'
import { canInsertNode, explainInsert } from '../rules'
import { collectIds, findNode, findParent } from '../tree'
import { makeNode, makePage } from './fixtures'

describe('ADD_NODE', () => {
  it('inserts at the requested index', () => {
    const page = makePage()
    const next = applyCommand(page, {
      type: 'ADD_NODE',
      parentId: 'section-1',
      node: makeNode('text', 'text-new'),
      index: 0,
    })
    expect(findNode(next.root, 'section-1')?.children?.[0]?.id).toBe('text-new')
  })

  it('refuses a node the parent does not accept', () => {
    const page = makePage()
    // heading is not a container at all.
    const intoLeaf = applyCommand(page, {
      type: 'ADD_NODE',
      parentId: 'heading-1',
      node: makeNode('text', 'text-new'),
    })
    expect(intoLeaf).toBe(page)

    // root only takes layout nodes.
    const intoRoot = applyCommand(page, {
      type: 'ADD_NODE',
      parentId: 'root',
      node: makeNode('heading', 'heading-new'),
    })
    expect(intoRoot).toBe(page)
  })

  it('is a no-op when the parent does not exist', () => {
    const page = makePage()
    expect(
      applyCommand(page, { type: 'ADD_NODE', parentId: 'nope', node: makeNode('text', 't') }),
    ).toBe(page)
  })
})

describe('DELETE_NODE', () => {
  it('deletes a subtree', () => {
    const page = makePage()
    const next = applyCommand(page, { type: 'DELETE_NODE', nodeId: 'section-1' })
    expect(findNode(next.root, 'section-1')).toBeNull()
    expect(findNode(next.root, 'heading-1')).toBeNull()
  })

  it('never deletes the root, and ignores unknown ids', () => {
    const page = makePage()
    expect(applyCommand(page, { type: 'DELETE_NODE', nodeId: 'root' })).toBe(page)
    expect(applyCommand(page, { type: 'DELETE_NODE', nodeId: 'nope' })).toBe(page)
  })
})

describe('MOVE_NODE', () => {
  it('reorders within one parent', () => {
    const page = makePage()
    const next = applyCommand(page, {
      type: 'MOVE_NODE',
      nodeId: 'heading-1',
      parentId: 'section-1',
      index: 2,
    })
    expect(findNode(next.root, 'section-1')?.children?.map((child) => child.id)).toEqual([
      'text-1',
      'heading-1',
    ])
  })

  it('moves across containers', () => {
    const page = makePage()
    const next = applyCommand(page, {
      type: 'MOVE_NODE',
      nodeId: 'heading-1',
      parentId: 'container-1',
      index: 0,
    })
    expect(findParent(next.root, 'heading-1')?.id).toBe('container-1')
    expect(findNode(next.root, 'section-1')?.children?.map((child) => child.id)).toEqual(['text-1'])
  })

  it('refuses to move a node into its own subtree', () => {
    const page = makePage()
    expect(
      applyCommand(page, { type: 'MOVE_NODE', nodeId: 'section-1', parentId: 'heading-1', index: 0 }),
    ).toBe(page)
    expect(
      applyCommand(page, { type: 'MOVE_NODE', nodeId: 'section-1', parentId: 'section-1', index: 0 }),
    ).toBe(page)
  })

  it('refuses a destination the rules reject, and never moves the root', () => {
    const page = makePage()
    expect(
      applyCommand(page, { type: 'MOVE_NODE', nodeId: 'heading-1', parentId: 'root', index: 0 }),
    ).toBe(page)
    expect(
      applyCommand(page, { type: 'MOVE_NODE', nodeId: 'root', parentId: 'section-1', index: 0 }),
    ).toBe(page)
  })

  it('is a no-op when the node already sits at that index', () => {
    const page = makePage()
    expect(
      applyCommand(page, { type: 'MOVE_NODE', nodeId: 'heading-1', parentId: 'section-1', index: 0 }),
    ).toBe(page)
  })
})

describe('DUPLICATE_NODE', () => {
  it('inserts a copy with fresh ids right after the original', () => {
    const page = makePage()
    const next = applyCommand(page, { type: 'DUPLICATE_NODE', nodeId: 'heading-1' })
    const children = findNode(next.root, 'section-1')?.children ?? []
    expect(children.map((child) => child.type)).toEqual(['heading', 'heading', 'text'])
    expect(children[1]?.id).not.toBe('heading-1')
    const ids = collectIds(next.root)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('refuses the root', () => {
    const page = makePage()
    expect(applyCommand(page, { type: 'DUPLICATE_NODE', nodeId: 'root' })).toBe(page)
  })
})

describe('UPDATE_PROPS / UPDATE_STYLE', () => {
  it('patches props without replacing the whole map', () => {
    const page = makePage()
    const next = applyCommand(page, {
      type: 'UPDATE_PROPS',
      nodeId: 'heading-1',
      patch: { text: 'Hello' },
    })
    const node = findNode(next.root, 'heading-1')
    expect(node?.props['text']).toBe('Hello')
    expect(node?.props['level']).toBe(findNode(page.root, 'heading-1')?.props['level'])
  })

  it('writes into one device layer only', () => {
    const page = makePage()
    const next = applyCommand(page, {
      type: 'UPDATE_STYLE',
      nodeId: 'heading-1',
      device: 'mobile',
      patch: { fontSize: '20px' },
    })
    const node = findNode(next.root, 'heading-1')
    expect(node?.styles.mobile?.['fontSize']).toBe('20px')
    expect(node?.styles.desktop?.['fontSize']).toBe(
      findNode(page.root, 'heading-1')?.styles.desktop?.['fontSize'],
    )
  })

  it('removes a declaration on null and returns the same page for unknown nodes', () => {
    const page = makePage()
    const withStyle = applyCommand(page, {
      type: 'UPDATE_STYLE',
      nodeId: 'heading-1',
      device: 'mobile',
      patch: { fontSize: '20px' },
    })
    const cleared = applyCommand(withStyle, {
      type: 'UPDATE_STYLE',
      nodeId: 'heading-1',
      device: 'mobile',
      patch: { fontSize: null },
    })
    expect(findNode(cleared.root, 'heading-1')?.styles.mobile?.['fontSize']).toBeUndefined()

    expect(
      applyCommand(page, { type: 'UPDATE_PROPS', nodeId: 'nope', patch: { text: 'x' } }),
    ).toBe(page)
  })
})

describe('reference equality', () => {
  it('SELECT_NODE never touches the document', () => {
    const page = makePage()
    expect(applyCommand(page, { type: 'SELECT_NODE', nodeId: 'heading-1' })).toBe(page)
  })

  it('a real change produces a new page object and a new updatedAt', () => {
    const page = makePage()
    const next = applyCommand(page, { type: 'DELETE_NODE', nodeId: 'text-1' })
    expect(next).not.toBe(page)
    expect(next.updatedAt).not.toBe(page.updatedAt)
  })
})

describe('compatibility rules', () => {
  it('root only accepts layout nodes', () => {
    expect(canInsertNode('root', 'section')).toBe(true)
    expect(canInsertNode('root', 'columns')).toBe(true)
    expect(canInsertNode('root', 'heading')).toBe(false)
  })

  it('columns only accepts containers', () => {
    expect(canInsertNode('columns', 'container')).toBe(true)
    expect(canInsertNode('columns', 'heading')).toBe(false)
  })

  it('leaf components accept nothing, and unknown types are refused with a reason', () => {
    expect(canInsertNode('heading', 'text')).toBe(false)
    expect(explainInsert('section', 'nope')).toEqual({
      ok: false,
      reason: 'unknown component type "nope"',
    })
    expect(explainInsert('nope', 'text').ok).toBe(false)
  })
})
