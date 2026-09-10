/**
 * Pure MIC template catalog. Does not touch the editor store or Canvas.
 */
import type { PageDocument } from '../../editor/core/types'
import {
  convertMICPageToBuilder,
  convertMICPageToComponentTree,
} from '../adapters/micComponentAdapter'
import { buildConsumerPage, CONSUMER_TEMPLATE_ID } from '../templates/consumer'
import { buildElectronicsPage, ELECTRONICS_TEMPLATE_ID } from '../templates/electronics'
import { buildMachineryPage, MACHINERY_TEMPLATE_ID } from '../templates/machinery'
import type { MICPageSchema } from '../schema/page'

export interface MicTemplateMeta {
  id: string
  name: string
  industry: string
  structure: string[]
}

const BUILDERS: Record<string, () => MICPageSchema> = {
  [MACHINERY_TEMPLATE_ID]: buildMachineryPage,
  [ELECTRONICS_TEMPLATE_ID]: buildElectronicsPage,
  [CONSUMER_TEMPLATE_ID]: buildConsumerPage,
}

function structureOf(page: MICPageSchema): string[] {
  return convertMICPageToComponentTree(page).map((node) => {
    switch (node.type) {
      case 'mic-product-hero':
        return 'Hero'
      case 'mic-feature-section':
        return 'Feature'
      case 'mic-specification-table':
        return 'Specification'
      case 'mic-factory-gallery':
        return 'Factory'
      case 'mic-certification':
        return 'Certification'
      case 'mic-packaging':
        return 'Packaging'
      case 'mic-faq':
        return 'FAQ'
      case 'mic-company-profile':
        return 'Company'
      default:
        return node.type
    }
  })
}

/** Catalog shown in Template Center. Structure is derived from the real tree. */
export function listMicTemplates(): MicTemplateMeta[] {
  return [
    {
      id: MACHINERY_TEMPLATE_ID,
      name: 'Machinery',
      industry: '机械设备',
      structure: structureOf(buildMachineryPage()),
    },
    {
      id: ELECTRONICS_TEMPLATE_ID,
      name: 'Electronic',
      industry: '电子电气',
      structure: structureOf(buildElectronicsPage()),
    },
    {
      id: CONSUMER_TEMPLATE_ID,
      name: 'Consumer',
      industry: '消费品 / 家电',
      structure: structureOf(buildConsumerPage()),
    },
  ]
}

export type TemplateResult =
  | { ok: true; page: MICPageSchema }
  | { ok: false; error: string }

/** Build a MIC page from a catalog id. Pure — no store writes. */
export function createMICPageFromTemplate(templateId: string): TemplateResult {
  const build = BUILDERS[templateId]
  if (!build) return { ok: false, error: `Unknown MIC template "${templateId}"` }
  return { ok: true, page: build() }
}

/** MIC page → builder document. Pure — the UI calls `replacePage` afterwards. */
export function createBuilderPageFromTemplate(templateId: string): PageDocument | null {
  const result = createMICPageFromTemplate(templateId)
  if (!result.ok) return null
  return convertMICPageToBuilder(result.page)
}
