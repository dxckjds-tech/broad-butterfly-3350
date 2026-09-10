import { createNode } from '../core/registry'
import type { EditorNode, ResponsiveStyles, StyleMap } from '../core/types'

function mergeLayer(base: StyleMap | undefined, patch: StyleMap | undefined): StyleMap | undefined {
  if (!base && !patch) return undefined
  return { ...(base ?? {}), ...(patch ?? {}) }
}

function mergeStyles(base: ResponsiveStyles, patch: ResponsiveStyles): ResponsiveStyles {
  const out: ResponsiveStyles = {}
  const desktop = mergeLayer(base.desktop, patch.desktop)
  const tablet = mergeLayer(base.tablet, patch.tablet)
  const mobile = mergeLayer(base.mobile, patch.mobile)
  if (desktop) out.desktop = desktop
  if (tablet) out.tablet = tablet
  if (mobile) out.mobile = mobile
  return out
}

/**
 * Preset node builder: starts from registry defaults, then layers on
 * preset-specific props, styles and children.
 */
export function node(
  type: string,
  options: {
    props?: Record<string, unknown>
    styles?: ResponsiveStyles
    children?: EditorNode[]
  } = {},
): EditorNode {
  const base = createNode(type)
  const built: EditorNode = {
    ...base,
    props: { ...base.props, ...(options.props ?? {}) },
    styles: mergeStyles(base.styles, options.styles ?? {}),
  }
  if (options.children) built.children = options.children
  return built
}
