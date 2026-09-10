/**
 * Read MIC component props out of `EditorNode.props` without `any`.
 * Presentational components stay props-only; the editor renderer uses these.
 */
import { asString, isRecord } from '../schema/coerce'

export interface FeatureItem {
  title: string
  description: string
  image?: string
}

export interface SpecItem {
  name: string
  value: string
}

export interface FaqItem {
  question: string
  answer: string
}

export interface GalleryItem {
  url: string
  type: string
}

function mapRecords<T>(value: unknown, map: (record: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(value)) return []
  const out: T[] = []
  for (const entry of value) {
    if (isRecord(entry)) out.push(map(entry))
  }
  return out
}

export function readFeatureList(value: unknown): FeatureItem[] {
  return mapRecords(value, (record) => {
    const item: FeatureItem = {
      title: asString(record['title']),
      description: asString(record['description']),
    }
    const image = asString(record['image'])
    if (image !== '') item.image = image
    return item
  })
}

export function readSpecList(value: unknown): SpecItem[] {
  return mapRecords(value, (record) => ({
    name: asString(record['name']),
    value: asString(record['value']),
  }))
}

export function readFaqList(value: unknown): FaqItem[] {
  return mapRecords(value, (record) => ({
    question: asString(record['question']),
    answer: asString(record['answer']),
  }))
}

export function readGalleryList(value: unknown): GalleryItem[] {
  return mapRecords(value, (record) => ({
    url: asString(record['url']),
    type: asString(record['type']) || 'factory',
  }))
}

export function readStringList(value: unknown): string[] {
  if (typeof value === 'string') {
    return value
      .split(/[,\n]/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  }
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}
