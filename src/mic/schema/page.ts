/**
 * Top-level MIC product-detail page: product + company + document metadata.
 *
 * `version` on metadata is the MIC schema version (`0.3.0`), independent of
 * the page-builder `PageDocument.schemaVersion` (still `1` in v0.2.1).
 */
import { emptyCompanySchema, parseCompanySchema } from './company'
import type { CompanySchema } from './company'
import { emptyProductSchema, parseProductSchema } from './product'
import type { ProductSchema } from './product'
import { asString, isRecord } from './coerce'

/** MIC page-model version introduced in v0.3.0 Step 1. */
export const MIC_PAGE_VERSION = '0.3.0'

export interface MICPageMetadata {
  createdAt: string
  updatedAt: string
  version: string
}

export interface MICPageSchema {
  product: ProductSchema
  company: CompanySchema
  metadata: MICPageMetadata
}

function nowIso(): string {
  return new Date().toISOString()
}

function parseMetadata(input: unknown): MICPageMetadata {
  const fallback: MICPageMetadata = {
    createdAt: '',
    updatedAt: '',
    version: MIC_PAGE_VERSION,
  }
  if (!isRecord(input)) return fallback
  return {
    createdAt: asString(input['createdAt']),
    updatedAt: asString(input['updatedAt']),
    version: asString(input['version']) || MIC_PAGE_VERSION,
  }
}

/** Empty MIC page — missing product, company, and timestamps. */
export function emptyMICPageSchema(): MICPageSchema {
  return {
    product: emptyProductSchema(),
    company: emptyCompanySchema(),
    metadata: {
      createdAt: '',
      updatedAt: '',
      version: MIC_PAGE_VERSION,
    },
  }
}

/**
 * Build a MIC page with current timestamps. Optional patches are parsed so
 * callers can pass partial / untrusted objects.
 */
export function createMICPageSchema(input: unknown = {}): MICPageSchema {
  const parsed = parseMICPageSchema(input)
  const stamp = nowIso()
  return {
    ...parsed,
    metadata: {
      createdAt: parsed.metadata.createdAt || stamp,
      updatedAt: parsed.metadata.updatedAt || stamp,
      version: parsed.metadata.version || MIC_PAGE_VERSION,
    },
  }
}

/**
 * Normalise untrusted input into a `MICPageSchema`.
 * Never throws. A missing product or company becomes the empty schema.
 */
export function parseMICPageSchema(input: unknown): MICPageSchema {
  const empty = emptyMICPageSchema()
  if (!isRecord(input)) return empty
  return {
    product: parseProductSchema(input['product']),
    company: parseCompanySchema(input['company']),
    metadata: parseMetadata(input['metadata']),
  }
}
