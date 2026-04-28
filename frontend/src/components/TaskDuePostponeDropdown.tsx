import { type NoteOut, patchNoteTask } from "@/api/notes"
import { ApiError } from "@/client"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
	formatDueAbsoluteTitle,
	formatDueRelative,
	isDueOverdue,
	isDueWithinTwentyFourHours,
	quickDueEndOfNextWeekIso,
	quickDueEndOfThisWeekIso,
	quickDueTomorrowIso,
} from "@/lib/dueDate"
import { cn } from "@/lib/utils"
import { useCallback, useRef, useState } from "react"

export type TaskDuePostponeDensity = "compact" | "comfortable"

export type TaskDuePostponeVariant = "open" | "done"

function toneClasses(overdue: boolean, dueSoon: boolean): string {
	if (overdue) {
		return "border-amber-500 bg-amber-500/30 text-amber-950 ring-2 ring-amber-500/35 dark:border-amber-500 dark:bg-amber-500/25 dark:text-amber-50 dark:ring-amber-400/40"
	}
	if (dueSoon) {
		return "border-red-500 bg-red-500/25 text-red-950 ring-2 ring-red-500/40 dark:border-red-500 dark:bg-red-600/30 dark:text-red-50 dark:ring-red-400/45"
	}
	return "border-border bg-muted/70 font-semibold text-foreground shadow-none ring-0 dark:border-border"
}

function sizeClasses(density: TaskDuePostponeDensity): string {
	if (density === "comfortable") {
		return "rounded-md border-2 px-2.5 py-1 text-sm font-bold tracking-tight shadow-md"
	}
	return "rounded-md border-2 px-2 py-1 text-xs font-bold shadow-sm"
}

type TaskDuePostponeDropdownProps = {
	noteId: string
	taskId: string
	dueAt: string | null | undefined
	density?: TaskDuePostponeDensity
	variant: TaskDuePostponeVariant
	disabled?: boolean
	className?: string
	onPatched: (note: NoteOut) => void | Promise<void>
	onError?: (message: string) => void
	/** For parent row busy / pointer-events coordination */
	onPatchingChange?: (patching: boolean) => void
}

export function TaskDuePostponeDropdown({
	noteId,
	taskId,
	dueAt,
	density = "compact",
	variant,
	disabled = false,
	className,
	onPatched,
	onError,
	onPatchingChange,
}: TaskDuePostponeDropdownProps) {
	const [patching, setPatching] = useState(false)
	const patchingRef = useRef(false)

	const dueLabel = formatDueRelative(dueAt)
	const dueTitle = formatDueAbsoluteTitle(dueAt)
	const hasDue = dueLabel != null
	const overdue = isDueOverdue(dueAt)
	const dueSoon = isDueWithinTwentyFourHours(dueAt)

	const runPatch = useCallback(
		async (due_at: string | null) => {
			if (disabled || patchingRef.current) return
			patchingRef.current = true
			setPatching(true)
			onPatchingChange?.(true)
			try {
				const note = await patchNoteTask(noteId, taskId, { due_at })
				await onPatched(note)
			} catch (e) {
				let msg = "Could not update due date"
				if (
					e instanceof ApiError &&
					e.body &&
					typeof e.body === "object"
				) {
					const d = e.body as { detail?: unknown }
					if (d.detail != null) msg = String(d.detail)
				} else if (e instanceof Error) msg = e.message
				onError?.(msg)
			} finally {
				patchingRef.current = false
				setPatching(false)
				onPatchingChange?.(false)
			}
		},
		[disabled, noteId, onError, onPatchingChange, onPatched, taskId],
	)

	if (variant === "done" && !hasDue) return null

	const busy = disabled || patching

	const triggerLabel =
		variant === "done"
			? hasDue
				? `Was due ${dueLabel}`
				: ""
			: hasDue
				? `Due ${dueLabel}`
				: "No due date"

	const triggerTitle = dueTitle
		? `${dueTitle} — reschedule`
		: hasDue
			? "Reschedule"
			: "Set due date"

	const tone = hasDue ? toneClasses(overdue, dueSoon) : ""
	const size = sizeClasses(density)

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					disabled={busy}
					title={triggerTitle}
					className={cn(
						size,
						hasDue ? tone : "border-dashed border-muted-foreground/40 bg-muted/30 text-xs font-medium text-muted-foreground",
						"shrink-0 self-start text-left outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50 sm:self-auto",
						className,
					)}
					onClick={(e) => e.stopPropagation()}
				>
					{triggerLabel}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-52">
				<DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
					Reschedule
				</DropdownMenuLabel>
				<DropdownMenuItem
					disabled={busy}
					onSelect={() => void runPatch(quickDueTomorrowIso())}
				>
					Tomorrow (noon)
				</DropdownMenuItem>
				<DropdownMenuItem
					disabled={busy}
					onSelect={() => void runPatch(quickDueEndOfThisWeekIso())}
				>
					End of this week
				</DropdownMenuItem>
				<DropdownMenuItem
					disabled={busy}
					onSelect={() => void runPatch(quickDueEndOfNextWeekIso())}
				>
					End of next week
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					disabled={busy || !hasDue}
					className="text-destructive focus:text-destructive"
					onSelect={() => void runPatch(null)}
				>
					Remove due date
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
