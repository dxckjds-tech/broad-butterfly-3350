/**
 * Core data model for the editor.
 *
 * The page is a JSON node tree — never HTML. Every renderer is a pure
 * projection of a node, so the same document can later be rendered by a
 * server-side publisher without touching the editor.
 */

export const DEVICES = ['desktop', 'tablet', 'mobile'] as const

export type Device = (typeof DEVICES)[number]

/** A single CSS declaration value. Kept intentionally narrow. */
export type StyleValue = string | number

/** camelCase CSS property -> value, e.g. `{ fontSize: '32px' }`. */
export type StyleMap = Record<string, StyleValue>

/**
 * Per-device style layers. `desktop` is the base layer; `tablet` and
 * `mobile` are sparse overrides that cascade down from it.
 */
export interface ResponsiveStyles {
  desktop?: StyleMap
  tablet?: StyleMap
  mobile?: StyleMap
}

export interface EditorNode {
  id: string
  type: string
  props: Record<string, unknown>
  styles: ResponsiveStyles
  children?: EditorNode[]
}

export interface PageDocument {
  /** Document identity, stable across saves. */
  id: string
  name: string
  /** Schema version, bumped when a migration is needed. */
  schemaVersion: number
  root: EditorNode
  updatedAt: string
}

export const SCHEMA_VERSION = 1

/** Root node type — always present, never selectable in the palette. */
export const ROOT_TYPE = 'root'
