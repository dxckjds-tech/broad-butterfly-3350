import { createId } from '../core/ids'
import { ROOT_TYPE, SCHEMA_VERSION } from '../core/types'
import type { EditorNode, PageDocument } from '../core/types'

/**
 * Node literals rather than `createNode()` — this module must not depend on
 * the registry being populated yet (it is imported by the store).
 */
export function createRootNode(children: EditorNode[] = []): EditorNode {
  return {
    id: 'root',
    type: ROOT_TYPE,
    props: {},
    styles: { desktop: { backgroundColor: '#ffffff', minHeight: '100%' } },
    children,
  }
}

export function createEmptyPage(name = 'Untitled page'): PageDocument {
  return {
    id: createId('page'),
    name,
    schemaVersion: SCHEMA_VERSION,
    root: createRootNode(),
    updatedAt: new Date().toISOString(),
  }
}
