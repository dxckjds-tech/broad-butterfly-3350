/**
 * Accept / Reject controls. Disabled unless the suggestion is still PENDING
 * so an already-applied item cannot be applied again from this button.
 */
export function ApprovalActions({
  disabled,
  onApprove,
  onReject,
}: {
  disabled?: boolean
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <div className="flex gap-1.5" data-testid="approval-actions">
      <button
        type="button"
        disabled={disabled}
        onClick={onApprove}
        className="rounded-md bg-brand-600 px-2.5 py-1 text-[11px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        接受
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onReject}
        className="rounded-md border border-shell-border bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        拒绝
      </button>
    </div>
  )
}
