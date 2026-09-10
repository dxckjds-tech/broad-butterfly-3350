/**
 * Hard limits shared by the validator, the reducer and the store.
 * These are the single source of truth — ARCHITECTURE.md quotes these
 * exact names, so changing a number here changes the documented number.
 */

/** Deepest allowed nesting, counting the root as depth 0. */
export const MAX_TREE_DEPTH = 32

/** Upper bound on nodes in one document, root included. */
export const MAX_NODE_COUNT = 5000

/** Undo stack size. Older entries are dropped from the front. */
export const HISTORY_LIMIT = 100

/**
 * Two mergeable edits with the same merge key collapse into one history
 * entry when they land within this window. Typing produces one entry per
 * keystroke; 600ms of silence starts a new one.
 */
export const HISTORY_MERGE_WINDOW_MS = 600

/**
 * Autosave waits this long after the last edit. Long enough that a burst of
 * typing writes once, short enough that a crash loses little.
 */
export const AUTOSAVE_DEBOUNCE_MS = 1200
