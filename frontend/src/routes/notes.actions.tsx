import {
	type NotesNextAction,
	listNotes,
	patchNoteTask,
} from "@/api/notes"
import { ApiError } from "@/client"
import { FollowUpSourceButton } from "@/components/IncomingUpdateSourceHint"
import { Button } from "@/components/ui/button"
import {
	datetimeLocalValueToIsoUtc,
	dueAtToDatetimeLocalValue,
	dueInstantsEqual,
	formatDueAbsoluteTitle,
	formatDueRelative,
	isDueOverdue,
	isDueWithinTwentyFourHours,
} from "@/lib/dueDate"
import { NOTES_NEXT_ACTIONS_HEADER_QUERY_KEY } from "@/components/NextActionsHeaderLink"
import { HomeLayout } from "@/components/layouts/HomeLayout"
import { ensureLoggedIn } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

const ACTIONS_PAGE_SIZE = 5

export const Route = createFileRoute("/notes/actions")({
	component: ActionsPage,
})

function ActionsSectionPagination({
	total,
	skip,
	pageSize,
	onPrev,
	onNext,
}: {
	total: number
	skip: number
	pageSize: number
	onPrev: () => void
	onNext: () => void
}) {
	if (total <= pageSize) return null
	const pageItemCount = Math.min(pageSize, total - skip)
	return (
		<div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
			<p className="text-xs text-muted-foreground">
				Showing {skip + 1}–{skip + pageItemCount} of {total}
			</p>
			<div className="flex shrink-0 justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={skip <= 0}
					onClick={onPrev}
				>
					Previous
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={skip + pageSize >= total}
					onClick={onNext}
				>
					Next
				</Button>
			</div>
		</div>
	)
}

function EditFollowUpForm({
	title,
	dueLocal,
	saving,
	onTitleChange,
	onDueLocalChange,
	onClearDue,
	onSave,
	onCancel,
}: {
	title: string
	dueLocal: string
	saving: boolean
	onTitleChange: (v: string) => void
	onDueLocalChange: (v: string) => void
	onClearDue: () => void
	onSave: () => void
	onCancel: () => void
}) {
	return (
		<div className="min-w-0 flex-1 space-y-2">
			<textarea
				value={title}
				onChange={(e) => onTitleChange(e.target.value)}
				rows={3}
				disabled={saving}
				className="w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
			/>
			<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
				<label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
					<span>Due (optional)</span>
					<input
						type="datetime-local"
						value={dueLocal}
						onChange={(e) => onDueLocalChange(e.target.value)}
						disabled={saving}
						className="w-full min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring sm:max-w-xs"
					/>
				</label>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="w-fit shrink-0"
					disabled={saving || dueLocal === ""}
					onClick={onClearDue}
				>
					Clear due
				</Button>
			</div>
			<div className="flex flex-wrap gap-2">
				<Button
					type="button"
					size="sm"
					disabled={saving}
					onClick={onSave}
				>
					{saving ? "Saving…" : "Save"}
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={saving}
					onClick={onCancel}
				>
					Cancel
				</Button>
			</div>
		</div>
	)
}

function ActionsPage() {
	const [mounted, setMounted] = useState(false)
	const [authChecked, setAuthChecked] = useState(false)
	const [loggedIn, setLoggedIn] = useState(false)
	const [nextActions, setNextActions] = useState<NotesNextAction[]>([])
	const [recentDoneActions, setRecentDoneActions] = useState<
		NotesNextAction[]
	>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(
		() => new Set(),
	)
	const completingRef = useRef<Set<string>>(new Set())
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const [openSkip, setOpenSkip] = useState(0)
	const [doneSkip, setDoneSkip] = useState(0)
	const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
	const [taskEditTitle, setTaskEditTitle] = useState("")
	const [taskEditDueLocal, setTaskEditDueLocal] = useState("")
	const [savingTaskId, setSavingTaskId] = useState<string | null>(null)

	useEffect(() => {
		setMounted(true)
	}, [])

	useEffect(() => {
		if (!mounted) return
		ensureLoggedIn().then((ok) => {
			setAuthChecked(true)
			if (!ok) navigate({ to: "/login" })
			else setLoggedIn(true)
		})
	}, [mounted, navigate])

	const load = useCallback(async () => {
		try {
			setLoading(true)
			setError(null)
			const res = await listNotes({ archived: false })
			const na = res.next_actions ?? []
			const da = res.recent_done_actions ?? []
			setNextActions(na)
			setRecentDoneActions(da)
			queryClient.setQueryData(NOTES_NEXT_ACTIONS_HEADER_QUERY_KEY, na)
		} catch (e) {
			let msg = "Failed to load actions"
			if (e instanceof ApiError && e.body && typeof e.body === "object") {
				const d = e.body as { detail?: unknown }
				if (d.detail) msg = String(d.detail)
			} else if (e instanceof Error) msg = e.message
			setError(msg)
		} finally {
			setLoading(false)
		}
	}, [queryClient])

	useEffect(() => {
		if (mounted && loggedIn) void load()
	}, [mounted, loggedIn, load])

	useEffect(() => {
		setOpenSkip((s) => {
			const total = nextActions.length
			if (total === 0) return 0
			const maxSkip =
				Math.floor((total - 1) / ACTIONS_PAGE_SIZE) * ACTIONS_PAGE_SIZE
			return Math.min(s, maxSkip)
		})
	}, [nextActions.length])

	useEffect(() => {
		setDoneSkip((s) => {
			const total = recentDoneActions.length
			if (total === 0) return 0
			const maxSkip =
				Math.floor((total - 1) / ACTIONS_PAGE_SIZE) * ACTIONS_PAGE_SIZE
			return Math.min(s, maxSkip)
		})
	}, [recentDoneActions.length])

	const pagedNextActions = useMemo(
		() =>
			nextActions.slice(openSkip, openSkip + ACTIONS_PAGE_SIZE),
		[nextActions, openSkip],
	)

	const pagedRecentDone = useMemo(
		() =>
			recentDoneActions.slice(doneSkip, doneSkip + ACTIONS_PAGE_SIZE),
		[recentDoneActions, doneSkip],
	)

	const markNextActionDone = async (a: NotesNextAction) => {
		if (completingRef.current.has(a.task_id)) return
		completingRef.current.add(a.task_id)
		setCompletingTaskIds(new Set(completingRef.current))
		setError(null)
		try {
			await patchNoteTask(a.note_id, a.task_id, { done: true })
			const res = await listNotes({ archived: false })
			const na = res.next_actions ?? []
			const da = res.recent_done_actions ?? []
			setNextActions(na)
			setRecentDoneActions(da)
			queryClient.setQueryData(NOTES_NEXT_ACTIONS_HEADER_QUERY_KEY, na)
		} catch (e) {
			let msg = "Could not mark follow-up done"
			if (e instanceof ApiError && e.body && typeof e.body === "object") {
				const d = e.body as { detail?: unknown }
				if (d.detail) msg = String(d.detail)
			} else if (e instanceof Error) msg = e.message
			setError(msg)
		} finally {
			completingRef.current.delete(a.task_id)
			setCompletingTaskIds(new Set(completingRef.current))
		}
	}

	const startEditingTask = useCallback((a: NotesNextAction) => {
		setEditingTaskId(a.task_id)
		setTaskEditTitle(a.task_title)
		setTaskEditDueLocal(dueAtToDatetimeLocalValue(a.due_at))
		setError(null)
	}, [])

	const cancelEditingTask = useCallback(() => {
		setEditingTaskId(null)
	}, [])

	const saveEditingTask = useCallback(
		async (a: NotesNextAction) => {
			const trimmed = taskEditTitle.trim()
			if (!trimmed) {
				setError("Follow-up text cannot be empty")
				return
			}
			const body: { title?: string; due_at?: string | null } = {}
			if (trimmed !== a.task_title) body.title = trimmed
			const newDueIso = datetimeLocalValueToIsoUtc(taskEditDueLocal)
			if (!dueInstantsEqual(a.due_at, newDueIso)) {
				body.due_at = newDueIso
			}
			if (Object.keys(body).length === 0) {
				setEditingTaskId(null)
				return
			}
			setSavingTaskId(a.task_id)
			setError(null)
			try {
				await patchNoteTask(a.note_id, a.task_id, body)
				const res = await listNotes({ archived: false })
				const na = res.next_actions ?? []
				const da = res.recent_done_actions ?? []
				setNextActions(na)
				setRecentDoneActions(da)
				queryClient.setQueryData(NOTES_NEXT_ACTIONS_HEADER_QUERY_KEY, na)
				setEditingTaskId(null)
			} catch (e) {
				let msg = "Could not update follow-up"
				if (
					e instanceof ApiError &&
					e.body &&
					typeof e.body === "object"
				) {
					const d = e.body as { detail?: unknown }
					if (Array.isArray(d.detail)) {
						msg = d.detail.map((x) => JSON.stringify(x)).join("; ")
					} else if (d.detail) msg = String(d.detail)
				} else if (e instanceof Error) msg = e.message
				setError(msg)
			} finally {
				setSavingTaskId((s) => (s === a.task_id ? null : s))
			}
		},
		[queryClient, taskEditTitle, taskEditDueLocal],
	)

	const markNextActionUndone = async (a: NotesNextAction) => {
		if (completingRef.current.has(a.task_id)) return
		completingRef.current.add(a.task_id)
		setCompletingTaskIds(new Set(completingRef.current))
		setError(null)
		try {
			await patchNoteTask(a.note_id, a.task_id, { done: false })
			const res = await listNotes({ archived: false })
			const na = res.next_actions ?? []
			const da = res.recent_done_actions ?? []
			setNextActions(na)
			setRecentDoneActions(da)
			queryClient.setQueryData(NOTES_NEXT_ACTIONS_HEADER_QUERY_KEY, na)
		} catch (e) {
			let msg = "Could not reopen follow-up"
			if (e instanceof ApiError && e.body && typeof e.body === "object") {
				const d = e.body as { detail?: unknown }
				if (d.detail) msg = String(d.detail)
			} else if (e instanceof Error) msg = e.message
			setError(msg)
		} finally {
			completingRef.current.delete(a.task_id)
			setCompletingTaskIds(new Set(completingRef.current))
		}
	}

	if (!mounted || !authChecked || !loggedIn) return null

	const hasOpen = nextActions.length > 0
	const hasDone = recentDoneActions.length > 0
	const hasAny = hasOpen || hasDone

	return (
		<HomeLayout>
			<div className="flex w-full flex-col gap-3 px-3 pb-6 pt-3 sm:px-4">
				{error && (
					<div
						role="alert"
						className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
					>
						{error}
					</div>
				)}

				{loading ? (
					<div className="h-40 animate-pulse rounded-xl border border-border bg-muted/40" />
				) : !hasAny ? (
					<div className="rounded-xl border border-dashed border-teal-200/70 bg-gradient-to-br from-teal-50/60 via-card to-card px-6 py-12 text-center dark:border-teal-800/40 dark:from-teal-950/25 dark:via-card dark:to-card">
						<p className="text-muted-foreground">
							When active notes have follow-ups, they show up here.{" "}
							<Link
								to="/notes"
								className="font-medium text-primary underline-offset-4 hover:underline"
							>
								Back to notes
							</Link>
						</p>
					</div>
				) : (
					<div className="flex flex-col gap-6">
						{hasOpen ? (
							<section
								className="rounded-xl border border-teal-200/70 bg-gradient-to-br from-teal-50/90 via-card to-card p-4 shadow-sm dark:border-teal-800/50 dark:from-teal-950/40 dark:via-card dark:to-card"
								aria-label="Next actions"
							>
								<div className="mb-3 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
									<h2 className="text-sm font-semibold tracking-wide text-teal-900 dark:text-teal-100">
										Next actions
									</h2>
									<p className="text-xs text-muted-foreground">
										Open follow-ups on active notes, soonest due
										first. Use the checkbox to mark one done
										without opening the note.
									</p>
								</div>
								<ol className="list-none space-y-1.5 p-0">
								{pagedNextActions.map((a) => {
									const dueLabel = formatDueRelative(a.due_at)
									const dueTitle = formatDueAbsoluteTitle(a.due_at)
									const overdue = isDueOverdue(a.due_at)
									const dueSoon = isDueWithinTwentyFourHours(
										a.due_at,
									)
									const noteTitle =
										a.note_title?.trim() || "Untitled"
									const busy = completingTaskIds.has(a.task_id)
									const isEditing = editingTaskId === a.task_id
									const isSaving = savingTaskId === a.task_id
									return (
										<li key={`${a.note_id}-${a.task_id}`}>
											<div
												className={cn(
													"flex flex-col gap-2 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-muted/30 sm:flex-row sm:items-start sm:gap-3",
													!isEditing &&
														busy &&
														"pointer-events-none opacity-60",
												)}
											>
												{isEditing ? (
													<EditFollowUpForm
														title={taskEditTitle}
														dueLocal={taskEditDueLocal}
														saving={isSaving}
														onTitleChange={setTaskEditTitle}
														onDueLocalChange={setTaskEditDueLocal}
														onClearDue={() =>
															setTaskEditDueLocal("")
														}
														onSave={() =>
															void saveEditingTask(a)
														}
														onCancel={cancelEditingTask}
													/>
												) : (
													<>
														<input
															type="checkbox"
															className="mt-0.5 h-4 w-4 shrink-0 rounded border-input sm:mt-0"
															checked={false}
															disabled={busy}
															aria-label={`Mark done: ${a.task_title}`}
															onChange={() =>
																void markNextActionDone(a)
															}
														/>
														<div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
															<Link
																to="/notes/$noteId"
																params={{ noteId: a.note_id }}
																className="min-w-0 flex-1 rounded-md outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
															>
																<p className="text-sm font-medium leading-snug text-foreground">
																	{a.task_title}
																</p>
																<p className="mt-0.5 truncate text-xs text-muted-foreground">
																	<span className="text-muted-foreground/80">
																		Note
																	</span>{" "}
																	· {noteTitle}
																</p>
															</Link>
															<div className="flex shrink-0 flex-row items-center gap-1.5 self-end sm:self-auto">
																{dueLabel ? (
																	<span
																		title={dueTitle ?? undefined}
																		className={
																			overdue
																				? "rounded-md border border-amber-400/45 bg-amber-500/15 px-2.5 py-1 text-sm font-bold tracking-tight text-amber-950 shadow-sm dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-50"
																				: dueSoon
																				  ? "rounded-md border border-red-400/50 bg-red-500/15 px-2.5 py-1 text-sm font-bold tracking-tight text-red-950 shadow-sm dark:border-red-700/50 dark:bg-red-950/35 dark:text-red-50"
																				  : "rounded-md border border-border bg-muted/70 px-2.5 py-1 text-sm font-bold tracking-tight text-foreground shadow-sm"
																		}
																	>
																		Due {dueLabel}
																	</span>
																) : (
																	<span className="text-xs text-muted-foreground">
																		No due date
																	</span>
																)}
																<Button
																	type="button"
																	variant="ghost"
																	size="sm"
																	className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
																	disabled={busy}
																	onClick={() =>
																		startEditingTask(a)
																	}
																>
																	Edit
																</Button>
																<FollowUpSourceButton
																	updateId={a.external_note_update_id}
																	onViewSource={(id) =>
																		void navigate({
																			to: "/notes/$noteId",
																			params: {
																				noteId: a.note_id,
																			},
																			search: {
																				followUpSource: id,
																			},
																		})
																	}
																/>
															</div>
														</div>
													</>
												)}
											</div>
										</li>
									)
								})}
								</ol>
								<ActionsSectionPagination
									total={nextActions.length}
									skip={openSkip}
									pageSize={ACTIONS_PAGE_SIZE}
									onPrev={() =>
										setOpenSkip((s) =>
											Math.max(0, s - ACTIONS_PAGE_SIZE),
										)
									}
									onNext={() =>
										setOpenSkip((s) => {
											const total = nextActions.length
											const maxSkip =
												total === 0
													? 0
													: Math.floor(
																(total - 1) /
																	ACTIONS_PAGE_SIZE,
															) * ACTIONS_PAGE_SIZE
											return Math.min(
												s + ACTIONS_PAGE_SIZE,
												maxSkip,
											)
										})
									}
								/>
							</section>
						) : (
							<p className="text-sm text-muted-foreground">
								No open follow-ups on active notes.
							</p>
						)}
						{hasDone ? (
							<section
								className="rounded-xl border border-border bg-muted/20 p-4 shadow-sm"
								aria-label="Completed follow-ups"
							>
								<div className="mb-3 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
									<h2 className="text-sm font-semibold tracking-wide text-foreground">
										Completed
									</h2>
									<p className="text-xs text-muted-foreground">
										Recently finished on active notes. Uncheck to
										move a follow-up back to open.
									</p>
								</div>
								<ol className="list-none space-y-1.5 p-0">
								{pagedRecentDone.map((a) => {
									const dueLabel = formatDueRelative(a.due_at)
									const dueTitle = formatDueAbsoluteTitle(a.due_at)
									const doneLabel = formatDueRelative(
										a.done_updated_ts,
									)
									const doneTitle = formatDueAbsoluteTitle(
										a.done_updated_ts,
									)
									const noteTitle =
										a.note_title?.trim() || "Untitled"
									const busy = completingTaskIds.has(a.task_id)
									const isEditing = editingTaskId === a.task_id
									const isSaving = savingTaskId === a.task_id
									return (
										<li key={`done-${a.note_id}-${a.task_id}`}>
											<div
												className={cn(
													"flex flex-col gap-2 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-muted/40 sm:flex-row sm:items-start sm:gap-3",
													!isEditing &&
														busy &&
														"pointer-events-none opacity-60",
												)}
											>
												{isEditing ? (
													<EditFollowUpForm
														title={taskEditTitle}
														dueLocal={taskEditDueLocal}
														saving={isSaving}
														onTitleChange={setTaskEditTitle}
														onDueLocalChange={setTaskEditDueLocal}
														onClearDue={() =>
															setTaskEditDueLocal("")
														}
														onSave={() =>
															void saveEditingTask(a)
														}
														onCancel={cancelEditingTask}
													/>
												) : (
													<>
														<input
															type="checkbox"
															className="mt-0.5 h-4 w-4 shrink-0 rounded border-input sm:mt-0"
															checked
															disabled={busy}
															aria-label={`Mark not done: ${a.task_title}`}
															onChange={() =>
																void markNextActionUndone(a)
															}
														/>
														<div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
															<Link
																to="/notes/$noteId"
																params={{ noteId: a.note_id }}
																className="min-w-0 flex-1 rounded-md outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
															>
																<p className="text-sm font-medium leading-snug text-muted-foreground line-through">
																	{a.task_title}
																</p>
																<p className="mt-0.5 truncate text-xs text-muted-foreground">
																	<span className="text-muted-foreground/80">
																		Note
																	</span>{" "}
																	· {noteTitle}
																</p>
															</Link>
															<div className="flex shrink-0 flex-row flex-wrap items-center justify-end gap-1.5 self-end text-xs text-muted-foreground sm:self-auto sm:text-right">
																{doneLabel ? (
																	<span
																		title={doneTitle ?? undefined}
																	>
																		Done {doneLabel}
																	</span>
																) : (
																	<span>Done</span>
																)}
																{dueLabel ? (
																	<span
																		title={dueTitle ?? undefined}
																		className="rounded-md border border-border bg-muted/50 px-2 py-1 text-xs font-bold tracking-tight text-foreground/90 shadow-sm"
																	>
																		Was due {dueLabel}
																	</span>
																) : null}
																<Button
																	type="button"
																	variant="ghost"
																	size="sm"
																	className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
																	disabled={busy}
																	onClick={() =>
																		startEditingTask(a)
																	}
																>
																	Edit
																</Button>
																<FollowUpSourceButton
																	updateId={a.external_note_update_id}
																	onViewSource={(id) =>
																		void navigate({
																			to: "/notes/$noteId",
																			params: {
																				noteId: a.note_id,
																			},
																			search: {
																				followUpSource: id,
																			},
																		})
																	}
																/>
															</div>
														</div>
													</>
												)}
											</div>
										</li>
									)
								})}
								</ol>
								<ActionsSectionPagination
									total={recentDoneActions.length}
									skip={doneSkip}
									pageSize={ACTIONS_PAGE_SIZE}
									onPrev={() =>
										setDoneSkip((s) =>
											Math.max(0, s - ACTIONS_PAGE_SIZE),
										)
									}
									onNext={() =>
										setDoneSkip((s) => {
											const total = recentDoneActions.length
											const maxSkip =
												total === 0
													? 0
													: Math.floor(
																(total - 1) /
																	ACTIONS_PAGE_SIZE,
															) * ACTIONS_PAGE_SIZE
											return Math.min(
												s + ACTIONS_PAGE_SIZE,
												maxSkip,
											)
										})
									}
								/>
							</section>
						) : null}
					</div>
				)}
			</div>
		</HomeLayout>
	)
}
