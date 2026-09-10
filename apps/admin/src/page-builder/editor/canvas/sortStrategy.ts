import type { SortingStrategy } from '@dnd-kit/sortable'

/**
 * Sorting strategy that never transforms siblings.
 *
 * The default list strategies slide real content out from under the
 * pointer, which in a page canvas means drop targets move while you aim at
 * them (and images/sections reflow). The drop indicator communicates the
 * same intent without touching layout.
 */
export const noShiftStrategy: SortingStrategy = () => null
