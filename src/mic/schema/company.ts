/**
 * MIC supplier / company block shown on a product detail page.
 *
 * Capacity and headcount are optional because many listings omit them.
 * Required fields still support emptiness (`''` / `[]`) when the page has
 * no company section at all.
 */
import { asString, asStringArray, isRecord } from './coerce'

export interface CompanySchema {
  name: string
  description: string
  factoryImages: string[]
  certifications: string[]
  capacity?: string
  employees?: string
}

/** Company block with every required field empty. Optional fields omitted. */
export function emptyCompanySchema(): CompanySchema {
  return {
    name: '',
    description: '',
    factoryImages: [],
    certifications: [],
  }
}

/**
 * Normalise untrusted input into a `CompanySchema`.
 * Optional `capacity` / `employees` are copied only when they are strings
 * (including `''`); missing keys stay undefined.
 */
export function parseCompanySchema(input: unknown): CompanySchema {
  const empty = emptyCompanySchema()
  if (!isRecord(input)) return empty

  const company: CompanySchema = {
    name: asString(input['name']),
    description: asString(input['description']),
    factoryImages: asStringArray(input['factoryImages']),
    certifications: asStringArray(input['certifications']),
  }

  if (typeof input['capacity'] === 'string') company.capacity = input['capacity']
  if (typeof input['employees'] === 'string') company.employees = input['employees']

  return company
}
