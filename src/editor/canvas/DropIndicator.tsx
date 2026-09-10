interface DropIndicatorProps {
  /** Row-direction parents need a vertical bar instead of a horizontal one. */
  horizontal?: boolean
}

/**
 * The insertion line. Rendered *inside* the target parent's child list at
 * the planned index, so its position is the layout itself rather than an
 * absolutely positioned guess.
 */
export function DropIndicator({ horizontal = false }: DropIndicatorProps) {
  return (
    <div
      aria-hidden
      data-drop-indicator
      className={
        horizontal
          ? 'relative my-0 -mx-0.5 w-1 shrink-0 self-stretch rounded-full bg-brand-500'
          : 'relative -my-0.5 h-1 w-full shrink-0 rounded-full bg-brand-500'
      }
    >
      <span
        className={
          horizontal
            ? 'absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500'
            : 'absolute left-0 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500'
        }
      />
    </div>
  )
}
