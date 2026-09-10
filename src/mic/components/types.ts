/**
 * Stable type ids for MIC builder nodes.
 *
 * These strings are `EditorNode.type` values. They are registered via
 * `registerComponent()` from each component file — `editor/core/registry.ts`
 * is not modified.
 */
export const MIC_COMPONENT_TYPES = [
  'mic-product-hero',
  'mic-feature-section',
  'mic-specification-table',
  'mic-certification',
  'mic-factory-gallery',
  'mic-packaging',
  'mic-faq',
  'mic-company-profile',
] as const

export type MicComponentType = (typeof MIC_COMPONENT_TYPES)[number]

/**
 * One node in the MIC component tree (schema → components, before wrapping
 * as builder `EditorNode`s). Props match the presentational component.
 */
export interface MicComponentNode {
  type: MicComponentType
  props: Record<string, unknown>
}

/** MIC components sit inside a Section/Container so root nesting rules stay intact. */
export const MIC_ALLOWED_PARENTS = ['section', 'container'] as const
