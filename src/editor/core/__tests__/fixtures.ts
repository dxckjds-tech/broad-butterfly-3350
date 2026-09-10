import '../../components'
import { createNode } from '../registry'
import { createRootNode } from '../../store/defaultPage'
import { SCHEMA_VERSION } from '../types'
import type { EditorNode, PageDocument } from '../types'

/**
 * Shared fixture. Importing this pulls in the component barrel, so the
 * registry is populated for every test that touches rules or validation.
 */
export function makeNode(type: string, id: string, children?: EditorNode[]): EditorNode {
  const node = createNode(type)
  return { ...node, id, ...(children ? { children } : {}) }
}

/**
 * root
 *   section-1
 *     heading-1
 *     text-1
 *   section-2
 *     container-1
 */
export function makePage(): PageDocument {
  const root = createRootNode([
    makeNode('section', 'section-1', [makeNode('heading', 'heading-1'), makeNode('text', 'text-1')]),
    makeNode('section', 'section-2', [makeNode('container', 'container-1', [])]),
  ])
  return {
    id: 'page-test',
    name: 'Test page',
    schemaVersion: SCHEMA_VERSION,
    root,
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}
