import { describe, expect, it } from 'vitest'
import {
  cloneWithNewIds,
  collectIds,
  depthOf,
  findNode,
  findParent,
  indexOfNode,
  insertNode,
  isDescendant,
  removeNode,
  updateNode,
} from '../tree'
import { makeNode, makePage } from './fixtures'

describe('findNode / findParent', () => {
  it('finds a node at any depth', () => {
    const { root } = makePage()
    expect(findNode(root, 'heading-1')?.type).toBe('heading')
    expect(findNode(root, 'root')?.id).toBe('root')
  })

  it('returns null for an unknown id', () => {
    const { root } = makePage()
    expect(findNode(root, 'nope')).toBeNull()
    expect(findParent(root, 'nope')).toBeNull()
  })

  it('finds the direct parent, and none for the root', () => {
    const { root } = makePage()
    expect(findParent(root, 'heading-1')?.id).toBe('section-1')
    expect(findParent(root, 'root')).toBeNull()
  })

  it('reports depth and sibling index', () => {
    const { root } = makePage()
    expect(depthOf(root, 'root')).toBe(0)
    expect(depthOf(root, 'section-1')).toBe(1)
    expect(depthOf(root, 'text-1')).toBe(2)
    expect(indexOfNode(root, 'text-1')).toBe(1)
    expect(indexOfNode(root, 'root')).toBe(-1)
  })
})

describe('insertNode', () => {
  it('inserts at an index and clamps out-of-range indexes', () => {
    const { root } = makePage()
    const inserted = insertNode(root, 'section-1', makeNode('text', 'text-new'), 1)
    expect(findNode(inserted, 'section-1')?.children?.map((child) => child.id)).toEqual([
      'heading-1',
      'text-new',
      'text-1',
    ])

    const appended = insertNode(root, 'section-1', makeNode('text', 'text-far'), 99)
    expect(findNode(appended, 'section-1')?.children?.at(-1)?.id).toBe('text-far')
  })

  it('appends when no index is given and leaves siblings untouched', () => {
    const { root } = makePage()
    const next = insertNode(root, 'section-2', makeNode('text', 'text-new'))
    expect(findNode(next, 'section-2')?.children?.map((child) => child.id)).toEqual([
      'container-1',
      'text-new',
    ])
    // Untouched branches keep their identity — cheap re-render checks.
    expect(findNode(next, 'section-1')).toBe(findNode(root, 'section-1'))
  })
})

describe('removeNode', () => {
  it('removes a node and reports where it came from', () => {
    const { root } = makePage()
    const result = removeNode(root, 'text-1')
    expect(result.removed?.id).toBe('text-1')
    expect(result.parentId).toBe('section-1')
    expect(result.index).toBe(1)
    expect(findNode(result.root, 'text-1')).toBeNull()
  })

  it('is a no-op for an unknown id', () => {
    const { root } = makePage()
    const result = removeNode(root, 'nope')
    expect(result.removed).toBeNull()
    expect(result.root).toBe(root)
  })
})

describe('updateNode', () => {
  it('replaces only the targeted node', () => {
    const { root } = makePage()
    const next = updateNode(root, 'heading-1', (node) => ({
      ...node,
      props: { ...node.props, text: 'Changed' },
    }))
    expect(findNode(next, 'heading-1')?.props['text']).toBe('Changed')
    expect(findNode(next, 'section-2')).toBe(findNode(root, 'section-2'))
  })
})

describe('cloneWithNewIds', () => {
  it('gives every node in the subtree a fresh id', () => {
    const { root } = makePage()
    const original = findNode(root, 'section-1')
    expect(original).not.toBeNull()
    const copy = cloneWithNewIds(original as NonNullable<typeof original>)

    const originalIds = collectIds(original as NonNullable<typeof original>)
    const copyIds = collectIds(copy)
    expect(copyIds).toHaveLength(originalIds.length)
    expect(copyIds.some((id) => originalIds.includes(id))).toBe(false)
    // Structure and content survive the copy.
    expect(copy.children?.map((child) => child.type)).toEqual(['heading', 'text'])
  })

  it('does not share style or prop objects with the original', () => {
    const source = { ...makeNode('heading', 'h'), styles: { desktop: { color: 'red' } } }
    const copy = cloneWithNewIds(source)
    expect(copy.styles.desktop).not.toBe(source.styles.desktop)
    expect(copy.props).not.toBe(source.props)
  })
})

describe('id uniqueness and descendants', () => {
  it('collectIds returns every id exactly once for a well-formed tree', () => {
    const { root } = makePage()
    const ids = collectIds(root)
    expect(ids).toEqual(['root', 'section-1', 'heading-1', 'text-1', 'section-2', 'container-1'])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('isDescendant walks the whole subtree and excludes self', () => {
    const { root } = makePage()
    expect(isDescendant(root, 'section-1', 'heading-1')).toBe(true)
    expect(isDescendant(root, 'root', 'container-1')).toBe(true)
    expect(isDescendant(root, 'section-1', 'container-1')).toBe(false)
    expect(isDescendant(root, 'section-1', 'section-1')).toBe(false)
  })
})
