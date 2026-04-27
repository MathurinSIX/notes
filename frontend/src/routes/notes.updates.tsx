import {
	type ExternalNoteUpdateOut,
	MY_EXTERNAL_NOTE_UPDATES_QUERY_KEY,
	type NotesListItem,
	listMyExternalNoteUpdates,
	listNotes,
	undoSentExternalNoteUpdate,
} from "@/api/notes"
import { reapplySentExternalNoteMerge } from "@/api/workflow"
import { ApiError } from "@/client"
import { HomeLayout } from "@/components/layouts/HomeLayout"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { ensureLoggedIn } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { LuArrowRightLeft, LuUndo2 } from "react-icons/lu"

function apiErrorMessage(e: unknown): string {
	if (e instanceof ApiError && e.body && typeof e.body === "object") {
		const d = (e.body as { detail?: unknown }).detail
		if (d != null) return String(d)
	}
	if (e instanceof Error) return e.message
	return String(e)
}

export const Route = createFileRoute("/notes/updates")({
	component: SentUpdatesPage,
})

const PAGE_SIZE = 5

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
		case "awaiting_note":
			return "bg-sky-500/15 text-sky-950 dark:text-sky-100"
		case "undone":
			return "bg-slate-500/15 text-slate-800 dark:text-slate-200"
		default:
			return "bg-muted text-foreground"
	}
}

function incomingUpdateStatusLabel(status: string): string {
	if (status === "awaiting_note") return "needs note"
	return status
}

function formatWhen(iso: string | null | undefined) {
	if (!iso) return "—"
	return new Date(iso).toLocaleString(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	})
}

function previewLine(body: string, max = 120) {
	const line = body.trim().split("\n", 1)[0]?.trim() ?? ""
	if (!line) return "—"
	if (line.length <= max) return line
	return `${line.slice(0, max - 1)}…`
}

function SentUpdatesPage() {
	const queryClient = useQueryClient()
	const [mounted, setMounted] = useState(false)
	const [authChecked, setAuthChecked] = useState(false)
	const [loggedIn, setLoggedIn] = useState(false)
	const [skip, setSkip] = useState(0)
	const [rawModalUpdate, setRawModalUpdate] =
		useState<ExternalNoteUpdateOut | null>(null)
	const [retargetUpdate, setRetargetUpdate] =
		useState<ExternalNoteUpdateOut | null>(null)
	const [retargetNoteId, setRetargetNoteId] = useState<string>("")
	const [retargetDialogError, setRetargetDialogError] = useState<
		string | null
	>(null)
	const navigate = useNavigate()

	useEffect(() => {
		setMounted(true)
	}, [])

	useEffect(() => {
		if (!mounted) return
		void ensureLoggedIn().then((ok) => {
			setAuthChecked(true)
			if (!ok) navigate({ to: "/login" })
			else setLoggedIn(true)
		})
	}, [mounted, navigate])

	const { data, isLoading, error } = useQuery({
		queryKey: [...MY_EXTERNAL_NOTE_UPDATES_QUERY_KEY, skip],
		queryFn: () => listMyExternalNoteUpdates({ skip, limit: PAGE_SIZE }),
		enabled: mounted && loggedIn,
	})

	const { data: notesPickData } = useQuery({
		queryKey: ["notesPick", "active"],
		queryFn: () => listNotes({ limit: 200, archived: false }),
		enabled: mounted && loggedIn && retargetUpdate != null,
	})

	const undoMutation = useMutation({
		mutationFn: (updateId: string) => undoSentExternalNoteUpdate(updateId),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: MY_EXTERNAL_NOTE_UPDATES_QUERY_KEY,
			})
		},
	})

	const reapplyMutation = useMutation({
		mutationFn: (vars: { updateId: string; targetNoteId: string }) =>
			reapplySentExternalNoteMerge(vars.updateId, {
				target_note_id: vars.targetNoteId,
			}),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: MY_EXTERNAL_NOTE_UPDATES_QUERY_KEY,
			})
			setRetargetDialogError(null)
			setRetargetUpdate(null)
			setRetargetNoteId("")
		},
	})

	const openRetarget = (u: ExternalNoteUpdateOut) => {
		undoMutation.reset()
		reapplyMutation.reset()
		setRetargetDialogError(null)
		setRetargetUpdate(u)
		setRetargetNoteId(u.matched_note_id ?? "")
	}

	useEffect(() => {
		if (!retargetUpdate || !notesPickData?.data?.length) return
		const ids = new Set(notesPickData.data.map((n: NotesListItem) => n.id))
		setRetargetNoteId((current) => {
			if (current && ids.has(current)) return current
			const preferred = retargetUpdate.matched_note_id
			if (preferred && ids.has(preferred)) return preferred
			return notesPickData.data[0].id
		})
	}, [retargetUpdate, notesPickData])

	if (!mounted || !authChecked || !loggedIn) return null

	const errMsg = error ? apiErrorMessage(error) : null

	const actionErr = undoMutation.error
		? apiErrorMessage(undoMutation.error)
		: null

	const rows = data?.data ?? []
	const total = data?.count ?? 0
	const canPrev = skip > 0
	const canNext = skip + PAGE_SIZE < total

	const goPrev = () => {
		setSkip((s) => Math.max(0, s - PAGE_SIZE))
	}
	const goNext = () => {
		setSkip((s) => s + PAGE_SIZE)
	}

	return (
		<HomeLayout>
			<div className="flex w-full flex-col gap-3 px-3 pb-6 pt-3 sm:px-4">
				{errMsg || actionErr ? (
					<div
						role="alert"
						className="space-y-1 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
					>
						{errMsg ? <p>{errMsg}</p> : null}
						{actionErr ? <p>{actionErr}</p> : null}
					</div>
				) : null}

				{isLoading ? (
					<div className="h-40 animate-pulse rounded-xl border border-border bg-muted/40" />
				) : total === 0 ? (
					<div className="rounded-xl border border-dashed border-amber-200/70 bg-gradient-to-br from-amber-50/60 via-card to-card px-6 py-12 text-center dark:border-amber-800/40 dark:from-amber-950/25 dark:via-card dark:to-card">
						<p className="text-muted-foreground">
							Use{" "}
							<strong className="text-foreground">
								Update notes
							</strong>{" "}
							in the header to send text for background merge. With
							automatic matching, pick a note in the dialog if you
							want to skip matching; otherwise choose a note here
							when a row shows{" "}
							<strong className="text-foreground">needs note</strong>
							.{" "}
							<Link
								to="/notes"
								className="font-medium text-primary underline-offset-4 hover:underline"
							>
								Back to notes
							</Link>
						</p>
					</div>
				) : (
					<section
						className="overflow-hidden rounded-xl border border-amber-200/70 bg-card shadow-sm dark:border-amber-800/50"
						aria-label="Sent updates"
					>
						<div className="overflow-x-auto">
							<table className="w-full min-w-[760px] border-collapse text-sm">
								<thead>
									<tr className="border-b border-border bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
										<th className="px-4 py-3">Sent</th>
										<th className="px-4 py-3">Merged</th>
										<th className="px-4 py-3">Status</th>
										<th className="px-4 py-3">Note</th>
										<th className="px-4 py-3">Preview</th>
										<th className="px-4 py-3 text-right">
											Raw
										</th>
										<th className="px-4 py-3 text-right">
											Actions
										</th>
									</tr>
								</thead>
								<tbody>
									{rows.map((u: ExternalNoteUpdateOut) => (
										<tr
											key={u.id}
											className="border-b border-border/80 last:border-0"
										>
											<td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
												{formatWhen(u.created_ts)}
											</td>
											<td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
												{formatWhen(
													u.merged_ts ?? null,
												)}
											</td>
											<td className="px-4 py-3">
												<span
													className={cn(
														"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
														incomingUpdateStatusClass(
															u.status,
														),
													)}
												>
													{incomingUpdateStatusLabel(
														u.status,
													)}
												</span>
											</td>
											<td className="px-4 py-3">
												{u.matched_note_id ? (
													<Link
														to="/notes/$noteId"
														params={{
															noteId: u.matched_note_id,
														}}
														search={
															u.status ===
															"merged"
																? {
																		incomingUpdate:
																			u.id,
																  }
																: undefined
														}
														className="font-medium text-primary underline-offset-4 hover:underline"
													>
														{u.matched_note_title?.trim() ||
															"Untitled"}
													</Link>
												) : (
													<span className="text-muted-foreground">
														—
													</span>
												)}
											</td>
											<td className="max-w-[280px] px-4 py-3 text-muted-foreground">
												<span className="line-clamp-2 break-words">
													{previewLine(u.body_md)}
												</span>
											</td>
											<td className="whitespace-nowrap px-4 py-3 text-right">
												<button
													type="button"
													onClick={() =>
														setRawModalUpdate(u)
													}
													className="font-medium text-primary underline-offset-4 hover:underline"
												>
													Raw
												</button>
											</td>
											<td className="px-4 py-3 text-right">
												<div className="flex flex-col items-end gap-1.5 sm:flex-row sm:justify-end sm:gap-2">
													{u.status === "awaiting_note" ? (
														<Button
															type="button"
															variant="secondary"
															size="sm"
															disabled={
																undoMutation.isPending ||
																reapplyMutation.isPending
															}
															onClick={() => {
																undoMutation.reset()
																reapplyMutation.reset()
																openRetarget(u)
															}}
														>
															Choose note…
														</Button>
													) : null}
													{u.status === "merged" ? (
														<>
															<Button
																type="button"
																variant="outline"
																size="sm"
																className="gap-1.5"
																disabled={
																	undoMutation.isPending ||
																	reapplyMutation.isPending
																}
																onClick={() => {
																	undoMutation.reset()
																	reapplyMutation.reset()
																	void undoMutation
																		.mutateAsync(
																			u.id,
																		)
																		.catch(
																			() => {
																				/* error on mutation */
																			},
																		)
																}}
															>
																<LuUndo2
																	className="size-4 shrink-0"
																	aria-hidden
																/>
																Undo merge
															</Button>
															<Button
																type="button"
																variant="secondary"
																size="sm"
																className="gap-1.5"
																disabled={
																	undoMutation.isPending ||
																	reapplyMutation.isPending
																}
																onClick={() => {
																	undoMutation.reset()
																	reapplyMutation.reset()
																	openRetarget(
																		u,
																	)
																}}
															>
																<LuArrowRightLeft
																	className="size-4 shrink-0"
																	aria-hidden
																/>
																Change target…
															</Button>
														</>
													) : null}
													{u.status === "undone" ? (
														<Button
															type="button"
															variant="secondary"
															size="sm"
															disabled={
																undoMutation.isPending ||
																reapplyMutation.isPending
															}
															onClick={() => {
																undoMutation.reset()
																reapplyMutation.reset()
																openRetarget(u)
															}}
														>
															Merge into…
														</Button>
													) : null}
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						{total > PAGE_SIZE ? (
							<div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
								<span>
									Showing {skip + 1}–
									{Math.min(skip + PAGE_SIZE, total)} of{" "}
									{total}
								</span>
								<div className="flex gap-2">
									<button
										type="button"
										disabled={!canPrev}
										onClick={goPrev}
										className="rounded-md border border-border bg-background px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
									>
										Previous
									</button>
									<button
										type="button"
										disabled={!canNext}
										onClick={goNext}
										className="rounded-md border border-border bg-background px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
									>
										Next
									</button>
								</div>
							</div>
						) : null}
					</section>
				)}
			</div>

			<Dialog
				open={retargetUpdate != null}
				onOpenChange={(open) => {
					if (!open) {
						setRetargetUpdate(null)
						setRetargetNoteId("")
						setRetargetDialogError(null)
						reapplyMutation.reset()
					}
				}}
			>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>
							{retargetUpdate?.status === "awaiting_note"
								? "Choose note to merge into"
								: retargetUpdate?.status === "undone"
									? "Merge into another note"
									: "Change target note"}
						</DialogTitle>
						<DialogDescription>
							{retargetUpdate?.status === "awaiting_note"
								? "Automatic matching did not find a note from titles and descriptions alone. Pick which note should receive this update."
								: retargetUpdate?.status === "undone"
									? "The stored update text will be merged into the note you pick (same text as before)."
									: "The merge on the current note will be undone, then the same update text will be merged into the note you pick."}
						</DialogDescription>
					</DialogHeader>
					{retargetDialogError ? (
						<div
							role="alert"
							className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/25 dark:text-red-300"
						>
							{retargetDialogError}
						</div>
					) : null}
					<div className="space-y-2 py-2">
						<label
							htmlFor="retarget-note"
							className="text-sm font-medium text-foreground"
						>
							Target note
						</label>
						<select
							id="retarget-note"
							className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							value={retargetNoteId}
							onChange={(ev) => {
								setRetargetDialogError(null)
								setRetargetNoteId(ev.target.value)
							}}
						>
							{(notesPickData?.data ?? []).map(
								(n: NotesListItem) => (
									<option key={n.id} value={n.id}>
										{n.title?.trim() || "Untitled"}
									</option>
								),
							)}
						</select>
					</div>
					<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
						<Button
							type="button"
							variant="outline"
							onClick={() => {
								setRetargetUpdate(null)
								setRetargetNoteId("")
							}}
						>
							Cancel
						</Button>
						<Button
							type="button"
							disabled={
								!retargetUpdate ||
								!retargetNoteId ||
								reapplyMutation.isPending
							}
							onClick={() => {
								if (!retargetUpdate || !retargetNoteId) return
								setRetargetDialogError(null)
								void reapplyMutation
									.mutateAsync({
										updateId: retargetUpdate.id,
										targetNoteId: retargetNoteId,
									})
									.catch((e: unknown) => {
										setRetargetDialogError(
											apiErrorMessage(e),
										)
									})
							}}
						>
							{reapplyMutation.isPending
								? "Queueing…"
								: "Queue merge"}
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog
				open={rawModalUpdate != null}
				onOpenChange={(open) => {
					if (!open) setRawModalUpdate(null)
				}}
			>
				<DialogContent className="flex max-h-[min(85vh,40rem)] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
					<div className="border-b border-border px-6 pb-4 pr-14 pt-6">
						<DialogHeader className="space-y-2 text-left">
							<DialogTitle>Update raw text</DialogTitle>
							<DialogDescription>
								Full markdown body for this sent update.
							</DialogDescription>
						</DialogHeader>
					</div>
					<div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
						{rawModalUpdate ? (
							<pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-4 font-mono text-xs leading-relaxed text-foreground">
								{rawModalUpdate.body_md.trim()
									? rawModalUpdate.body_md
									: "—"}
							</pre>
						) : null}
					</div>
				</DialogContent>
			</Dialog>
		</HomeLayout>
	)
}
