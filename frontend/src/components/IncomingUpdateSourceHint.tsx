import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Opens the follow-up “source update” modal (note page) or navigates with
 * `followUpSource` (Actions) — no inline preview of the update body.
 */
export function FollowUpSourceButton({
	updateId,
	onViewSource,
	className,
}: {
	updateId: string | null | undefined
	onViewSource: (externalNoteUpdateId: string) => void
	className?: string
}) {
	if (!updateId) return null
	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			className={cn(
				"h-7 shrink-0 px-2 text-[11px] font-medium leading-none",
				className,
			)}
			onClick={() => onViewSource(updateId)}
		>
			View source
		</Button>
	)
}
