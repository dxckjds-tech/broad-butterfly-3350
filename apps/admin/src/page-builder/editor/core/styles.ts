import type { CSSProperties } from 'react'
import type { Device, EditorNode, ResponsiveStyles, StyleMap, StyleValue } from './types'

/** Layer order applied when resolving a device: base first, override last. */
const CASCADE: Record<Device, Device[]> = {
  desktop: ['desktop'],
  tablet: ['desktop', 'tablet'],
  mobile: ['desktop', 'tablet', 'mobile'],
}

/** Flatten the responsive layers down to the styles that apply on `device`. */
export function resolveStyles(styles: ResponsiveStyles, device: Device): StyleMap {
  const out: StyleMap = {}
  for (const layer of CASCADE[device]) {
    Object.assign(out, styles[layer] ?? {})
  }
  return out
}

export function resolveNodeStyles(node: EditorNode, device: Device): StyleMap {
  return resolveStyles(node.styles, device)
}

/**
 * Style keys are camelCase CSS properties by construction (see STYLE_GROUPS),
 * so the cast is safe and keeps the data model free of React types.
 */
export function toCssProperties(map: StyleMap): CSSProperties {
  return map as unknown as CSSProperties
}

/** Does this device layer explicitly override `key`? Drives the override dot. */
export function hasOverride(styles: ResponsiveStyles, device: Device, key: string): boolean {
  const layer = styles[device]
  return layer !== undefined && Object.prototype.hasOwnProperty.call(layer, key)
}

/**
 * Which layer actually supplies `key` on `device` — the last layer in the
 * cascade that declares it, or null when nothing does. The inspector uses this
 * to tell "overridden here" from "inherited from a wider breakpoint".
 */
export function originOf(styles: ResponsiveStyles, device: Device, key: string): Device | null {
  for (const layer of [...CASCADE[device]].reverse()) {
    if (hasOverride(styles, layer, key)) return layer
  }
  return null
}

/** Merge a patch into one device layer; `null`/`''` removes the declaration. */
export function mergeStyleLayer(
  styles: ResponsiveStyles,
  device: Device,
  patch: Record<string, StyleValue | null>,
): ResponsiveStyles {
  const layer: StyleMap = { ...(styles[device] ?? {}) }
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === '') delete layer[key]
    else layer[key] = value
  }
  const next: ResponsiveStyles = { ...styles }
  if (Object.keys(layer).length === 0) delete next[device]
  else next[device] = layer
  return next
}
