import { describe, expect, it } from 'vitest'
import { parsePageDocument } from '../schema'
import { migratePageDocument } from '../migrations'
import { MAX_TREE_DEPTH } from '../limits'
import { SCHEMA_VERSION } from '../types'
import type { EditorNode } from '../types'
import { makePage } from './fixtures'

/** JSON round-trip: parse must cope with plain data, not live objects. */
function asJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown
}

describe('a good document', () => {
  it('parses and reports no migrations', () => {
    const result = parsePageDocument(asJson(makePage()))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.page.root.id).toBe('root')
    expect(result.migrated).toEqual([])
  })
})

describe('malformed input', () => {
  it('rejects non-objects and missing fields without throwing', () => {
    for (const input of [null, undefined, 42, 'a string', [], {}]) {
      const result = parsePageDocument(input)
      expect(result.ok).toBe(false)
    }
  })

  it('rejects a node whose props are not an object', () => {
    const page = asJson(makePage()) as { root: { children: unknown[] } }
    page.root.children[0] = { id: 'x', type: 'section', props: 'nope', styles: {} }
    const result = parsePageDocument(page)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues[0]?.code).toBe('SHAPE')
  })

  it('rejects a circular document instead of hanging', () => {
    const page = makePage()
    const section = page.root.children?.[0] as EditorNode
    section.children = [page.root]
    const result = parsePageDocument(page)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues[0]?.code).toBe('CYCLE')
  })
})

describe('tree invariants', () => {
  it('rejects duplicate ids', () => {
    const page = asJson(makePage()) as { root: { children: Array<{ id: string }> } }
    const first = page.root.children[0]
    const second = page.root.children[1]
    if (!first || !second) throw new Error('fixture changed')
    second.id = first.id
    const result = parsePageDocument(page)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.some((issue) => issue.code === 'DUPLICATE_ID')).toBe(true)
  })

  it('rejects an empty id', () => {
    const page = asJson(makePage()) as { root: { children: Array<{ id: string }> } }
    const first = page.root.children[0]
    if (!first) throw new Error('fixture changed')
    first.id = '   '
    const result = parsePageDocument(page)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.some((issue) => issue.code === 'EMPTY_ID')).toBe(true)
  })

  it('rejects a root of the wrong type', () => {
    const page = asJson(makePage()) as { root: { type: string } }
    page.root.type = 'section'
    const result = parsePageDocument(page)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.some((issue) => issue.code === 'ROOT_TYPE')).toBe(true)
  })

  it('rejects an unknown component type', () => {
    const page = asJson(makePage()) as { root: { children: Array<{ type: string }> } }
    const first = page.root.children[0]
    if (!first) throw new Error('fixture changed')
    first.type = 'carousel-3000'
    const result = parsePageDocument(page)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.some((issue) => issue.code === 'UNKNOWN_TYPE')).toBe(true)
  })

  it('rejects children under a leaf component and under an incompatible parent', () => {
    const leaf = asJson(makePage()) as {
      root: { children: Array<{ children?: unknown[] }> }
    }
    const section = leaf.root.children[0] as { children: unknown[] }
    const heading = section.children[0] as { children?: unknown[] }
    heading.children = [{ id: 'inner', type: 'text', props: {}, styles: {} }]
    const leafResult = parsePageDocument(leaf)
    expect(leafResult.ok).toBe(false)
    if (leafResult.ok) return
    expect(leafResult.issues.some((issue) => issue.code === 'ILLEGAL_CHILDREN')).toBe(true)

    const wrongParent = asJson(makePage()) as { root: { children: unknown[] } }
    wrongParent.root.children.push({ id: 'loose', type: 'heading', props: {}, styles: {} })
    const parentResult = parsePageDocument(wrongParent)
    expect(parentResult.ok).toBe(false)
    if (parentResult.ok) return
    expect(parentResult.issues.some((issue) => issue.code === 'ILLEGAL_CHILDREN')).toBe(true)
  })

  it('rejects a tree deeper than MAX_TREE_DEPTH', () => {
    const page = asJson(makePage()) as { root: { children: unknown[] } }
    // A chain of containers, deliberately past the ceiling.
    let node: { id: string; type: string; props: object; styles: object; children: unknown[] } = {
      id: 'deep-0',
      type: 'container',
      props: {},
      styles: {},
      children: [],
    }
    const top = node
    for (let i = 1; i <= MAX_TREE_DEPTH + 2; i += 1) {
      const child = { id: `deep-${i}`, type: 'container', props: {}, styles: {}, children: [] }
      node.children.push(child)
      node = child
    }
    page.root.children = [top]
    const result = parsePageDocument(page)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues[0]?.code).toBe('DEPTH_EXCEEDED')
  })
})

describe('schemaVersion', () => {
  it('reads the current version', () => {
    const page = asJson({ ...makePage(), schemaVersion: SCHEMA_VERSION })
    expect(parsePageDocument(page).ok).toBe(true)
  })

  it('refuses a document from a newer editor', () => {
    const page = asJson({ ...makePage(), schemaVersion: SCHEMA_VERSION + 1 })
    const result = parsePageDocument(page)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues[0]?.code).toBe('VERSION_TOO_NEW')
  })

  it('migrates an older document forward', () => {
    const old = { ...makePage(), schemaVersion: 0 }
    const migrated = migratePageDocument(old)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    expect(migrated.page.schemaVersion).toBe(SCHEMA_VERSION)
    expect(migrated.applied).toEqual([1])

    const parsed = parsePageDocument(asJson(old))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.page.schemaVersion).toBe(SCHEMA_VERSION)
    expect(parsed.migrated).toEqual([1])
  })
})
