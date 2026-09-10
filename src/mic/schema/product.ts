/**
 * MIC product-detail data model (v0.3.0 Step 1).
 *
 * This is a page-level snapshot for AI Store Doctor, not a builder node.
 * Every field can be empty so a half-scraped or newly created listing still
 * parses: missing specs → `[]`, missing FAQ → `[]`, missing copy → `''`.
 */
import { parseImageSchemaList } from './image'
import type { ImageSchema } from './image'
import { asString, asStringArray, isRecord } from './coerce'

/** One parameter row on the MIC specification table. */
export interface Specification {
  /** Parameter name, e.g. `"Voltage"`. Empty when unknown. */
  name: string
  /** Parameter value, e.g. `"220V"`. Empty when unknown. */
  value: string
}

/** One FAQ pair from the product page. */
export interface FAQ {
  question: string
  answer: string
}

/**
 * Provenance of the listing. All strings empty when the source is unknown;
 * the adapter fills what it can from the builder document identity.
 */
export interface SourceInfo {
  /** Public product URL, empty when not captured. */
  url: string
  /** Platform label (`"MIC"`, …), empty when not captured. */
  platform: string
  /** Remote product id, empty when not captured. */
  externalId: string
}

export interface ProductSchema {
  id: string
  productName: string
  category: string
  keywords: string[]
  images: ImageSchema[]
  description: string
  specifications: Specification[]
  certifications: string[]
  packaging: string
  faq: FAQ[]
  companyProfile: string
  sourceInfo: SourceInfo
}

/** Empty source block — valid, just unknown. */
export function emptySourceInfo(): SourceInfo {
  return { url: '', platform: '', externalId: '' }
}

/** Empty product — every array is `[]`, every string is `''`. */
export function emptyProductSchema(): ProductSchema {
  return {
    id: '',
    productName: '',
    category: '',
    keywords: [],
    images: [],
    description: '',
    specifications: [],
    certifications: [],
    packaging: '',
    faq: [],
    companyProfile: '',
    sourceInfo: emptySourceInfo(),
  }
}

function parseSpecification(input: unknown): Specification {
  if (!isRecord(input)) return { name: '', value: '' }
  return { name: asString(input['name']), value: asString(input['value']) }
}

function parseFaq(input: unknown): FAQ {
  if (!isRecord(input)) return { question: '', answer: '' }
  return { question: asString(input['question']), answer: asString(input['answer']) }
}

function parseSourceInfo(input: unknown): SourceInfo {
  if (!isRecord(input)) return emptySourceInfo()
  return {
    url: asString(input['url']),
    platform: asString(input['platform']),
    externalId: asString(input['externalId']),
  }
}

/**
 * Normalise untrusted input into a `ProductSchema`.
 * Never throws. Missing `specifications` / `faq` / `images` become `[]`.
 */
export function parseProductSchema(input: unknown): ProductSchema {
  const empty = emptyProductSchema()
  if (!isRecord(input)) return empty
  return {
    id: asString(input['id']),
    productName: asString(input['productName']),
    category: asString(input['category']),
    keywords: asStringArray(input['keywords']),
    images: parseImageSchemaList(input['images']),
    description: asString(input['description']),
    specifications: Array.isArray(input['specifications'])
      ? input['specifications'].map(parseSpecification)
      : [],
    certifications: asStringArray(input['certifications']),
    packaging: asString(input['packaging']),
    faq: Array.isArray(input['faq']) ? input['faq'].map(parseFaq) : [],
    companyProfile: asString(input['companyProfile']),
    sourceInfo: parseSourceInfo(input['sourceInfo']),
  }
}
