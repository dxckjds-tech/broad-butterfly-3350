/**
 * MIC product-detail image model.
 *
 * Built so later agents (Product Identity, image recognition, gallery sort)
 * can tag a picture without touching the page-builder node tree. Every field
 * is safe when missing: parsers fill empty strings / `"unknown"` / `0`.
 */
import { asEnum, asNumber, asString, isRecord } from './coerce'

/** Roles a product photo can play on a Made-in-China detail page. */
export const IMAGE_TYPES = [
  'main',
  'feature',
  'application',
  'detail',
  'specification',
  'certificate',
  'factory',
  'unknown',
] as const

export type ImageType = (typeof IMAGE_TYPES)[number]

/**
 * Where the image came from. `PAGE` is scraped / mapped from the builder;
 * `USER` is an editor upload; `AI_REFERENCE` is a suggested asset that must
 * not be treated as already on the live listing.
 */
export const IMAGE_SOURCES = ['PAGE', 'USER', 'AI_REFERENCE'] as const

export type ImageSource = (typeof IMAGE_SOURCES)[number]

export interface ImageSchema {
  id: string
  url: string
  type: ImageType
  order: number
  source: ImageSource
}

/** Empty image row — valid, just unused. */
export function emptyImageSchema(): ImageSchema {
  return {
    id: '',
    url: '',
    type: 'unknown',
    order: 0,
    source: 'PAGE',
  }
}

/**
 * Normalise untrusted input into an `ImageSchema`.
 * Never throws; unknown shapes become an empty image.
 */
export function parseImageSchema(input: unknown, index = 0): ImageSchema {
  const base = emptyImageSchema()
  if (!isRecord(input)) return { ...base, order: index }
  return {
    id: asString(input['id']),
    url: asString(input['url']),
    type: asEnum(input['type'], IMAGE_TYPES, 'unknown'),
    order: asNumber(input['order'], index),
    source: asEnum(input['source'], IMAGE_SOURCES, 'PAGE'),
  }
}

/**
 * Parse an images array. Missing / non-array input yields `[]` so a page
 * with no gallery is still a valid product.
 */
export function parseImageSchemaList(input: unknown): ImageSchema[] {
  if (!Array.isArray(input)) return []
  return input.map((entry, index) => parseImageSchema(entry, index))
}
