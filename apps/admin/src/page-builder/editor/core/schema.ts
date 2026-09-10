import { z } from 'zod'
import { migratePageDocument } from './migrations'
import { DEVICES } from './types'
import type { EditorNode, PageDocument } from './types'
import { preflight, validateDocument } from './validate'
import type { DocumentIssue, ValidateOptions } from './validate'

const styleValueSchema = z.union([z.string(), z.number()])

const styleMapSchema = z.record(z.string(), styleValueSchema)

export const responsiveStylesSchema = z.object({
  desktop: styleMapSchema.optional(),
  tablet: styleMapSchema.optional(),
  mobile: styleMapSchema.optional(),
})

export const deviceSchema = z.enum(DEVICES)

export const editorNodeSchema: z.ZodType<EditorNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    props: z.record(z.string(), z.unknown()),
    styles: responsiveStylesSchema,
    children: z.array(editorNodeSchema).optional(),
  }),
)

/**
 * Shape only. Version acceptance is decided by the migration runner and
 * tree-wide invariants by `validateDocument`, so a document from a newer
 * editor still parses here and is refused with a precise message later.
 */
export const pageDocumentSchema: z.ZodType<PageDocument> = z.object({
  id: z.string().min(1),
  name: z.string(),
  // Any integer version passes the *shape* stage; acceptance and forward
  // migration are decided in `migrations`, which needs to see old versions.
  schemaVersion: z.number().int().nonnegative(),
  root: editorNodeSchema,
  updatedAt: z.string(),
})

export type ParseResult =
  | { ok: true; page: PageDocument; migrated: number[] }
  | { ok: false; error: string; issues: DocumentIssue[] }

/**
 * The single entry point for untrusted documents — localStorage, an
 * imported file, and (phase two) an API response or AI-generated JSON.
 *
 * Four stages, in this order:
 *   1. preflight  — cycle / depth / size guards on the raw value, because
 *                   the recursive Zod schema would loop on a cycle
 *   2. Zod        — field shapes and types
 *   3. migrate    — version acceptance and forward migration
 *   4. validate   — tree-wide invariants (unique ids, registry, nesting)
 */
export function parsePageDocument(input: unknown, options: ValidateOptions = {}): ParseResult {
  const shapeIssue = preflight(input)
  if (shapeIssue) return { ok: false, error: shapeIssue.message, issues: [shapeIssue] }

  const result = pageDocumentSchema.safeParse(input)
  if (!result.success) {
    const first = result.error.issues[0]
    const where = first && first.path.length > 0 ? first.path.join('.') : 'document'
    const message = `${where}: ${first ? first.message : 'invalid document'}`
    return {
      ok: false,
      error: message,
      issues: [{ code: 'SHAPE', path: where, message }],
    }
  }

  const migrated = migratePageDocument(result.data)
  if (!migrated.ok) {
    return {
      ok: false,
      error: migrated.error,
      issues: [{ code: 'VERSION_TOO_NEW', path: 'schemaVersion', message: migrated.error }],
    }
  }

  const issues = validateDocument(migrated.page, options)
  if (issues.length > 0) {
    const first = issues[0]
    return {
      ok: false,
      error: first ? `${first.path}: ${first.message}` : 'invalid document',
      issues,
    }
  }

  return { ok: true, page: migrated.page, migrated: migrated.applied }
}
