import type { ComponentType, CSSProperties, MouseEvent, ReactNode } from 'react'
import { createId } from './ids'
import type { Device, EditorNode, ResponsiveStyles, StyleValue } from './types'

/** Minimal icon contract — avoids coupling the registry to lucide's types. */
export type IconComponent = ComponentType<{
  size?: number | string
  className?: string
  strokeWidth?: number
}>

/**
 * Props the canvas injects into a node's root DOM element. Renderers must
 * spread this onto their outermost element — that is how selection, hover
 * and drag targeting work without wrapping every node in an extra div.
 */
/**
 * Props a renderer spreads onto its outermost element. The index signature
 * carries dnd-kit's drag activator props (role, tabIndex, aria-*, pointer and
 * key handlers) without this module having to know about dnd-kit.
 */
export interface NodeChrome extends Record<string, unknown> {
  className: string
  style: CSSProperties
  'data-node-id': string
  onClick: (event: MouseEvent) => void
  onMouseEnter: (event: MouseEvent) => void
  onMouseLeave: (event: MouseEvent) => void
  ref?: (element: HTMLElement | null) => void
}

export interface RendererProps {
  node: EditorNode
  device: Device
  chrome: NodeChrome
  /** Rendered children, already wired for selection. Containers only. */
  children?: ReactNode
  /** True in preview mode — renderers may drop editor-only affordances. */
  preview: boolean
}

export interface InspectorProps {
  node: EditorNode
  updateProps: (patch: Record<string, unknown>) => void
  updateStyle: (patch: Record<string, StyleValue | null>) => void
  device: Device
}

export type ComponentCategory = 'layout' | 'basic' | 'media'

export interface ComponentDefinition {
  type: string
  label: string
  icon: IconComponent
  category: ComponentCategory
  /** Short palette description. */
  description?: string
  /** Can hold children — also makes the node a drop target. */
  acceptsChildren: boolean
  /**
   * Optional nesting constraints, enforced centrally by `core/rules.ts`.
   * `acceptsChildren` alone is too coarse: Columns accepts children but only
   * Containers, and a Section belongs at the top level, not inside a Button.
   */
  allowedChildren?: readonly string[]
  allowedParents?: readonly string[]
  /** Last-word predicate for rules an allow-list cannot express. */
  canDrop?: (parent: ComponentDefinition, child: ComponentDefinition) => boolean
  /** Hidden from the palette (e.g. the root node). */
  hidden?: boolean
  defaultProps: Record<string, unknown>
  defaultStyles: ResponsiveStyles
  /**
   * Lazily built starter children (e.g. Columns ships with two columns).
   * Called at insert time, so it may reference other registered components.
   */
  defaultChildren?: () => EditorNode[]
  renderer: ComponentType<RendererProps>
  /** Content-tab editor. Omitted for components with no content props. */
  inspector?: ComponentType<InspectorProps>
}

const registry = new Map<string, ComponentDefinition>()

export function registerComponent(definition: ComponentDefinition): void {
  if (registry.has(definition.type)) {
    // Keep HMR idempotent instead of throwing on re-registration.
    registry.set(definition.type, definition)
    return
  }
  registry.set(definition.type, definition)
}

export function getComponent(type: string): ComponentDefinition | undefined {
  return registry.get(type)
}

export function listComponents(): ComponentDefinition[] {
  return [...registry.values()].filter((definition) => !definition.hidden)
}

export function listComponentsByCategory(category: ComponentCategory): ComponentDefinition[] {
  return listComponents().filter((definition) => definition.category === category)
}

export function acceptsChildren(type: string): boolean {
  return registry.get(type)?.acceptsChildren ?? false
}

/** Build a fresh node from the registry defaults. */
export function createNode(type: string, overrides?: Partial<EditorNode>): EditorNode {
  const definition = registry.get(type)
  if (!definition) {
    throw new Error(`Unknown component type: ${type}`)
  }
  const base: EditorNode = {
    id: createId(type.slice(0, 3)),
    type,
    props: { ...definition.defaultProps },
    styles: structuredCloneStyles(definition.defaultStyles),
    ...(definition.acceptsChildren
      ? { children: definition.defaultChildren ? definition.defaultChildren() : [] }
      : {}),
  }
  return { ...base, ...overrides }
}

function structuredCloneStyles(styles: ResponsiveStyles): ResponsiveStyles {
  return {
    ...(styles.desktop ? { desktop: { ...styles.desktop } } : {}),
    ...(styles.tablet ? { tablet: { ...styles.tablet } } : {}),
    ...(styles.mobile ? { mobile: { ...styles.mobile } } : {}),
  }
}
