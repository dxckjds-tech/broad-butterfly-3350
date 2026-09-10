import { createId } from '../core/ids'
import { SCHEMA_VERSION } from '../core/types'
import type { PageDocument } from '../core/types'
import { createRootNode } from '../store/defaultPage'
import { SECTION_PRESETS } from './sections'

export interface TemplatePreset {
  id: string
  label: string
  description: string
  build: () => PageDocument
}

function buildSections(ids: readonly string[]) {
  return ids.flatMap((id) => {
    const preset = SECTION_PRESETS.find((entry) => entry.id === id)
    return preset ? [preset.build()] : []
  })
}

function page(name: string, sectionIds: readonly string[]): PageDocument {
  return {
    id: createId('page'),
    name,
    schemaVersion: SCHEMA_VERSION,
    root: createRootNode(buildSections(sectionIds)),
    updatedAt: new Date().toISOString(),
  }
}

/** Whole-page starters. Applying one replaces the document (and history). */
export const TEMPLATE_PRESETS: readonly TemplatePreset[] = [
  {
    id: 'blank',
    label: 'Blank page',
    description: 'Start from an empty canvas',
    build: () => page('Untitled page', []),
  },
  {
    id: 'landing',
    label: 'Product landing',
    description: 'Hero → feature → three-up → CTA',
    build: () => page('Product landing', ['hero-centered', 'feature-two-column', 'three-up', 'cta-banner']),
  },
  {
    id: 'audit-offer',
    label: 'Audit offer',
    description: 'Hero and CTA only',
    build: () => page('Audit offer', ['hero-centered', 'cta-banner']),
  },
]
