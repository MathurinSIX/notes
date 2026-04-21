import {
	type ExternalNoteUpdateOut,
	getNoteIncomingUpdate,
} from "@/api/notes"
import { ApiError } from "@/client"
import { MarkdownPreview } from "@/components/editor/MarkdownPreview"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { useEffect, useState } from "react"

function formatUpdated(iso: string) {
	return new Date(iso).toLocaleString(undefined, {
		dateStyle: "long",
		timeStyle: "short",
	})
}

function incomingUpdateStatusClass(status: string): string {
	switch (status) {
		case "merged":
			return "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100"
		case "pending":
			return "bg-amber-500/15 text-amber-950 dark:text-amber-50"
		case "failed":
			return "bg-rose-500/15 text-rose-950 dark:text-rose-50"
		case "no_match":
			return "bg-muted text-muted-foreground"
		default:
			return "bg-muted text-foreground"
	}
}

type FollowUpSourceModalProps = {
	noteId: string
	updateId: string | null
	open: boolean
	onOpenChange: (open: boolean) => void
}

/**
 * Modal showing a single incoming merge update (source for a follow-up task).
 */
export function FollowUpSourceModal({
	noteId,
	updateId,
	open,
	onOpenChange,
}: FollowUpSourceModalProps) {
	const [row, setRow] = useState<ExternalNoteUpdateOut | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!open || !updateId) {
			setRow(null)
			setError(null)
			setLoading(false)
			return
		}
		let cancelled = false
		;(async () => {
			setLoading(true)
			setError(null)
			try {
				const r = await getNoteIncomingUpdate(noteId, updateId)
				if (!cancelled) setRow(r)
			} catch (e) {
				let msg = "Could not load source update"
				if (
					e instanceof ApiError &&
					e.body &&
					typeof e.body === "object"
				) {
					const d = e.body as { detail?: unknown }
					if (d.detail) msg = String(d.detail)
				} else if (e instanceof Error) msg = e.message
				if (!cancelled) setError(msg)
			} finally {
				if (!cancelled) setLoading(false)
			}
		})()
		return () => {
			cancelled = true
		}
	}, [open, noteId, updateId])

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[min(85vh,40rem)] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
				<div className="border-b border-border px-6 pb-4 pr-14 pt-6">
					<DialogHeader className="space-y-2 text-left">
						<DialogTitle>Source update</DialogTitle>
						<DialogDescription>
							Incoming text used when this follow-up was added or last
							linked from a merge.
						</DialogDescription>
					</DialogHeader>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
					{loading ? (
						<p className="text-sm text-muted-foreground">Loading…</p>
					) : null}
					{error ? (
						<p
							role="alert"
							className="text-sm text-red-600 dark:text-red-400"
						>
							{error}
						</p>
					) : null}
					{!loading && !error && row ? (
						<div className="space-y-4">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<p className="text-xs text-muted-foreground">
									{formatUpdated(row.created_ts)}
								</p>
								<span
									className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${incomingUpdateStatusClass(row.status)}`}
								>
									{row.status}
								</span>
							</div>
							{row.error_message ? (
								<p
									role="status"
									className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100"
								>
									{row.error_message}
								</p>
							) : null}
							<div className="rounded-md border border-border bg-muted/20 p-3">
								<MarkdownPreview
									source={
										row.body_md.trim() ? row.body_md : "*No body.*"
									}
									framed={false}
								/>
							</div>
						</div>
					) : null}
				</div>
			</DialogContent>
		</Dialog>
	)
}
