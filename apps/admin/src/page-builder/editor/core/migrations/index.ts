import { SCHEMA_VERSION } from '../types'
import type { PageDocument } from '../types'
import { migrateToV1 } from './v1'

/**
 * Ordered migration chain. `to` is the version the step produces, so the
 * runner can apply every step above the document's current version.
 */
interface Migration {
  to: number
  run: (document: PageDocument) => PageDocument
}

const MIGRATIONS: readonly Migration[] = [{ to: 1, run: migrateToV1 }]

export type MigrationResult =
  | { ok: true; page: PageDocument; applied: number[] }
  | { ok: false; error: string }

/**
 * Bring a document up to `SCHEMA_VERSION`.
 *
 * - older than current -> run every step above its version, in order
 * - equal to current   -> returned untouched
 * - newer than current -> refused; a newer editor wrote it and we would
 *   silently drop fields we do not understand
 */
export function migratePageDocument(document: PageDocument): MigrationResult {
  const from = document.schemaVersion

  if (from > SCHEMA_VERSION) {
    return {
      ok: false,
      error: `schemaVersion: document is version ${from}, this editor understands up to ${SCHEMA_VERSION}`,
    }
  }
  if (from === SCHEMA_VERSION) return { ok: true, page: document, applied: [] }

  let page = document
  const applied: number[] = []
  for (const migration of MIGRATIONS) {
    if (migration.to <= from) continue
    page = migration.run(page)
    applied.push(migration.to)
  }

  if (page.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      error: `schemaVersion: no migration path from version ${from} to ${SCHEMA_VERSION}`,
    }
  }
  return { ok: true, page, applied }
}

export { migrateToV1 }
