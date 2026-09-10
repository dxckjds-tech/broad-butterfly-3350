import type { PageDocument } from '../types'

/**
 * Migration into schema version 1.
 *
 * Version 1 is the first published shape, so there is nothing to rewrite
 * yet — this exists so the chain in `index.ts` has a real entry and the
 * next migration is a copy of this file, not a new mechanism.
 *
 * A migration receives a document that passed the *shape* schema but may
 * predate the current invariants, and must return a document that
 * satisfies version 1.
 */
export function migrateToV1(document: PageDocument): PageDocument {
  if (document.schemaVersion === 1) return document
  return { ...document, schemaVersion: 1 }
}
