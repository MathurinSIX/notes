import {
	type ChunkHistoryEvent,
	type ChunkOut,
	type NoteHistoryEvent,
	type NoteOut,
	type TaskHistoryEvent,
	type NoteTaskOut,
	createChunk,
	deleteChunk,
	deleteNote,
	getChunkHistory,
	getNote,
	getNoteHistory,
	getNoteIncomingUpdates,
	patchNoteTask,
	updateChunk,
	updateNote,
	type ExternalNoteUpdateOut,
} from "@/api/notes"
import { ApiError } from "@/client"
import { LineDiffBlock } from "@/components/diff/LineDiffBlock"
import { MarkdownEditor } from "@/components/editor/MarkdownEditor"
import { MarkdownPreview } from "@/components/editor/MarkdownPreview"
import { FollowUpSourceModal } from "@/components/FollowUpSourceModal"
import { FollowUpSourceButton } from "@/components/IncomingUpdateSourceHint"
import { HomeLayout } from "@/components/layouts/HomeLayout"
import {
	ONGOING_WORKFLOW_RUNS_QUERY_KEY,
	ongoingWorkflowRunsQueryOptions,
} from "@/lib/ongoingWorkflowRunsQuery"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { ensureLoggedIn } from "@/hooks/useAuth"
import {
	datetimeLocalValueToIsoUtc,
	dueAtToDatetimeLocalValue,
	dueInstantsEqual,
	formatDueAbsoluteTitle,
	formatDueRelative,
	isDueWithinTwentyFourHours,
} from "@/lib/dueDate"
import { rememberUpdateNotesFallbackNoteId } from "@/lib/updateNotesFallback"
import {
	chunkHistoryDiffText,
	findPreviousChunkEvent,
	findPreviousNoteEvent,
	findPreviousTaskEvent,
} from "@/lib/noteHistoryDiff"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"

/** Avoid opening the incoming-updates modal twice (e.g. React Strict Mode). */
const consumedIncomingDeepLinks = new Set<string>()
const consumedFollowUpSourceDeepLinks = new Set<string>()

type NoteDetailSearch = {
	incomingUpdate?: string
	followUpSource?: string
}

export const Route = createFileRoute("/notes/$noteId")({
	validateSearch: (raw: Record<string, unknown>): NoteDetailSearch => {
		const out: NoteDetailSearch = {}
		const inc = raw.incomingUpdate
		if (typeof inc === "string" && inc.length > 0) {
			out.incomingUpdate = inc
		}
		const fps = raw.followUpSource
		if (typeof fps === "string" && fps.length > 0) {
			out.followUpSource = fps
		}
		return out
	},
	component: NoteDetailPage,
})

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

const HISTORY_PAGE_SIZE = 5
const TASK_PAGE_SIZE = 8

function clampTaskSkip(skip: number, total: number, pageSize: number): number {
	if (total === 0) return 0
	const maxSkip = Math.max(0, (Math.ceil(total / pageSize) - 1) * pageSize)
	return Math.min(skip, maxSkip)
}

function partitionNoteTasks(tasks: NoteTaskOut[] | undefined) {
	const raw = tasks ?? []
	const sorted = [...raw].sort(
		(a, b) =>
			a.sort_order - b.sort_order ||
			a.created_ts.localeCompare(b.created_ts),
	)
	return {
		openFollowUps: sorted.filter((t) => !t.done),
		doneFollowUps: sorted.filter((t) => t.done),
	}
}

/** Rotating accent for section cards (full class strings for Tailwind JIT). */
const SECTION_ACCENT_BAR = [
	"before:bg-emerald-500 dark:before:bg-emerald-400",
	"before:bg-sky-500 dark:before:bg-sky-400",
	"before:bg-violet-500 dark:before:bg-violet-400",
	"before:bg-amber-500 dark:before:bg-amber-400",
	"before:bg-rose-500 dark:before:bg-rose-400",
] as const

function HistoryPaginationFooter({
	total,
	skip,
	pageItemCount,
	loading,
	pageSize,
	onPrev,
	onNext,
}: {
	total: number
	skip: number
	pageItemCount: number
	loading: boolean
	pageSize: number
	onPrev: () => void
	onNext: () => void
}) {
	return (
		<div className="flex flex-col gap-3 border-t border-border px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
			<p className="text-xs text-muted-foreground">
				{total > 0
					? `Showing ${skip + 1}–${skip + pageItemCount} of ${total}`
					: null}
			</p>
			<div className="flex shrink-0 justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={loading || skip <= 0 || total === 0}
					onClick={onPrev}
				>
					Previous
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={
						loading || total === 0 || skip + pageSize >= total
					}
					onClick={onNext}
				>
					Next
				</Button>
			</div>
		</div>
	)
}

function NoteDetailPage() {
	const { noteId } = Route.useParams()
	const search = Route.useSearch()
	const [mounted, setMounted] = useState(false)
	const [authChecked, setAuthChecked] = useState(false)
	const [loggedIn, setLoggedIn] = useState(false)
	const [note, setNote] = useState<NoteOut | null>(null)
	const [title, setTitle] = useState("")
	const [summary, setSummary] = useState("")
	const [editingTitle, setEditingTitle] = useState(false)
	const [editingChunkId, setEditingChunkId] = useState<string | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [historyLoading, setHistoryLoading] = useState(false)
	const [historyError, setHistoryError] = useState<string | null>(null)
	const [historyLoaded, setHistoryLoaded] = useState(false)
	const [historyEvents, setHistoryEvents] = useState<
		(NoteHistoryEvent | ChunkHistoryEvent | TaskHistoryEvent)[]
	>([])
	const [historySkip, setHistorySkip] = useState(0)
	const [historyTotal, setHistoryTotal] = useState(0)
	const [historyOpen, setHistoryOpen] = useState(false)
	const [sectionHistoryOpen, setSectionHistoryOpen] = useState(false)
	const [sectionHistoryChunkId, setSectionHistoryChunkId] = useState<
		string | null
	>(null)
	const [sectionHistoryLoading, setSectionHistoryLoading] = useState(false)
	const [sectionHistoryError, setSectionHistoryError] = useState<
		string | null
	>(null)
	const [sectionHistoryLoaded, setSectionHistoryLoaded] = useState(false)
	const [sectionHistoryEvents, setSectionHistoryEvents] = useState<
		ChunkHistoryEvent[]
	>([])
	const [sectionHistorySkip, setSectionHistorySkip] = useState(0)
	const [sectionHistoryTotal, setSectionHistoryTotal] = useState(0)
	const [incomingUpdatesOpen, setIncomingUpdatesOpen] = useState(false)
	const [incomingUpdatesLoading, setIncomingUpdatesLoading] =
		useState(false)
	const [incomingUpdatesError, setIncomingUpdatesError] = useState<
		string | null
	>(null)
	const [incomingUpdatesList, setIncomingUpdatesList] = useState<
		ExternalNoteUpdateOut[]
	>([])
	const [incomingHighlightId, setIncomingHighlightId] = useState<
		string | null
	>(null)
	const [incomingUpdatesChunkId, setIncomingUpdatesChunkId] = useState<
		string | null
	>(null)
	const [followUpSourceId, setFollowUpSourceId] = useState<string | null>(
		null,
	)
	const [taskOpenSkip, setTaskOpenSkip] = useState(0)
	const [taskDoneSkip, setTaskDoneSkip] = useState(0)
	const [taskListView, setTaskListView] = useState<"active" | "done">(
		"active",
	)
	const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
	const [taskEditTitle, setTaskEditTitle] = useState("")
	const [taskEditDueLocal, setTaskEditDueLocal] = useState("")
	const [hadOngoingWorkflows, setHadOngoingWorkflows] = useState(false)
	const navigate = useNavigate()
	const { data: ongoingRunsData } = useQuery({
		queryKey: ONGOING_WORKFLOW_RUNS_QUERY_KEY,
		...ongoingWorkflowRunsQueryOptions(),
	})

	useEffect(() => {
		rememberUpdateNotesFallbackNoteId(noteId)
	}, [noteId])

	useEffect(() => {
		setEditingTaskId(null)
	}, [noteId])

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

	const loadHistory = useCallback(
		async (pageSkip: number) => {
			try {
				setHistoryLoading(true)
				setHistoryError(null)
				const h = await getNoteHistory(noteId, {
					skip: pageSkip,
					limit: HISTORY_PAGE_SIZE,
				})
				setHistoryEvents(h.events)
				setHistorySkip(h.skip)
				setHistoryTotal(h.total)
				setHistoryLoaded(true)
			} catch (e) {
				let msg = "Failed to load history"
				if (
					e instanceof ApiError &&
					e.body &&
					typeof e.body === "object"
				) {
					const d = e.body as { detail?: unknown }
					if (d.detail) msg = String(d.detail)
				} else if (e instanceof Error) msg = e.message
				setHistoryError(msg)
			} finally {
				setHistoryLoading(false)
			}
		},
		[noteId],
	)

	const loadSectionHistory = useCallback(
		async (chunkId: string, pageSkip: number) => {
			try {
				setSectionHistoryLoading(true)
				setSectionHistoryError(null)
				const h = await getChunkHistory(noteId, chunkId, {
					skip: pageSkip,
					limit: HISTORY_PAGE_SIZE,
				})
				setSectionHistoryEvents(h.events)
				setSectionHistorySkip(h.skip)
				setSectionHistoryTotal(h.total)
				setSectionHistoryLoaded(true)
			} catch (e) {
				let msg = "Failed to load section history"
				if (
					e instanceof ApiError &&
					e.body &&
					typeof e.body === "object"
				) {
					const d = e.body as { detail?: unknown }
					if (d.detail) msg = String(d.detail)
				} else if (e instanceof Error) msg = e.message
				setSectionHistoryError(msg)
			} finally {
				setSectionHistoryLoading(false)
			}
		},
		[noteId],
	)

	const loadIncomingUpdates = useCallback(
		async (chunkId?: string | null) => {
			try {
				setIncomingUpdatesLoading(true)
				setIncomingUpdatesError(null)
				const r = await getNoteIncomingUpdates(
					noteId,
					chunkId
						? {
								chunkId,
							}
						: undefined,
				)
				setIncomingUpdatesList(r.data)
			} catch (e) {
				let msg = "Failed to load incoming updates"
			if (
				e instanceof ApiError &&
				e.body &&
				typeof e.body === "object"
			) {
				const d = e.body as { detail?: unknown }
				if (d.detail) msg = String(d.detail)
			} else if (e instanceof Error) msg = e.message
				setIncomingUpdatesError(msg)
			} finally {
				setIncomingUpdatesLoading(false)
			}
		},
		[noteId],
	)

	const openIncomingUpdatesModal = useCallback(
		(highlightId?: string | null, chunkId?: string | null) => {
			setIncomingUpdatesOpen(true)
			setIncomingHighlightId(highlightId ?? null)
			setIncomingUpdatesChunkId(chunkId ?? null)
			void loadIncomingUpdates(chunkId ?? null)
		},
		[loadIncomingUpdates],
	)

	useEffect(() => {
		return () => {
			for (const k of [...consumedIncomingDeepLinks]) {
				if (k.startsWith(`${noteId}:`)) {
					consumedIncomingDeepLinks.delete(k)
				}
			}
			for (const k of [...consumedFollowUpSourceDeepLinks]) {
				if (k.startsWith(`${noteId}:`)) {
					consumedFollowUpSourceDeepLinks.delete(k)
				}
			}
		}
	}, [noteId])

	useEffect(() => {
		if (!mounted || !loggedIn) return
		const fps = search.followUpSource
		if (fps) {
			const key = `${noteId}:fps:${fps}`
			if (!consumedFollowUpSourceDeepLinks.has(key)) {
				consumedFollowUpSourceDeepLinks.add(key)
				setFollowUpSourceId(fps)
			}
			void navigate({
				to: "/notes/$noteId",
				params: { noteId },
				search: {},
				replace: true,
			})
			return
		}
		const id = search.incomingUpdate
		if (!id) return
		const key = `${noteId}:${id}`
		if (consumedIncomingDeepLinks.has(key)) return
		consumedIncomingDeepLinks.add(key)
		openIncomingUpdatesModal(id)
		void navigate({
			to: "/notes/$noteId",
			params: { noteId },
			search: {},
			replace: true,
		})
	}, [
		mounted,
		loggedIn,
		noteId,
		search.incomingUpdate,
		search.followUpSource,
		openIncomingUpdatesModal,
		navigate,
	])

	const load = useCallback(async () => {
		try {
			setLoading(true)
			setError(null)
			const n = await getNote(noteId)
			const parts = partitionNoteTasks(n.tasks)
			setTaskListView(
				parts.openFollowUps.length === 0 &&
					parts.doneFollowUps.length > 0
					? "done"
					: "active",
			)
			setNote(n)
			setTitle(n.title ?? "")
			setSummary(n.summary ?? "")
			setHistoryLoaded(false)
			setHistoryEvents([])
			setHistorySkip(0)
			setHistoryTotal(0)
			setSectionHistoryOpen(false)
			setSectionHistoryChunkId(null)
			setSectionHistoryLoaded(false)
			setSectionHistoryEvents([])
			setSectionHistorySkip(0)
			setSectionHistoryTotal(0)
			setSectionHistoryError(null)
		} catch (e) {
			let msg = "Failed to load note"
			if (e instanceof ApiError && e.body && typeof e.body === "object") {
				const d = e.body as { detail?: unknown }
				if (d.detail) msg = String(d.detail)
			} else if (e instanceof Error) msg = e.message
			setError(msg)
		} finally {
			setLoading(false)
		}
	}, [noteId])

	useEffect(() => {
		if (mounted && loggedIn) void load()
	}, [mounted, loggedIn, load])

	useEffect(() => {
		const ongoingCount = ongoingRunsData?.count ?? 0
		if (ongoingCount > 0) {
			if (!hadOngoingWorkflows) setHadOngoingWorkflows(true)
			return
		}
		if (!hadOngoingWorkflows || !mounted || !loggedIn) return
		setHadOngoingWorkflows(false)
		void load()
	}, [ongoingRunsData?.count, hadOngoingWorkflows, mounted, loggedIn, load])

	useEffect(() => {
		setTaskOpenSkip(0)
		setTaskDoneSkip(0)
		setTaskListView("active")
	}, [noteId])

	useEffect(() => {
		if (
			!incomingUpdatesOpen ||
			!incomingHighlightId ||
			incomingUpdatesList.length === 0
		) {
			return
		}
		const id = `incoming-update-${incomingHighlightId}`
		requestAnimationFrame(() => {
			document.getElementById(id)?.scrollIntoView({
				behavior: "smooth",
				block: "nearest",
			})
		})
	}, [incomingUpdatesOpen, incomingHighlightId, incomingUpdatesList])

	const cancelTitleEdit = () => {
		if (note) {
			setTitle(note.title ?? "")
			setSummary(note.summary ?? "")
		}
		setEditingTitle(false)
	}

	const saveTitle = async () => {
		if (!note) return
		try {
			const trimmedSummary = summary.trim()
			const n = await updateNote(note.id, {
				title: title || null,
				summary: trimmedSummary ? trimmedSummary : null,
			})
			setNote(n)
			setEditingTitle(false)
		} catch (e) {
			setError(e instanceof Error ? e.message : "Save failed")
		}
	}

	const saveArchived = async (archived: boolean) => {
		if (!note) return
		if (archived) {
			if (
				!window.confirm(
					"Archive this note? It will be removed from your main list.",
				)
			) {
				return
			}
		}
		try {
			setError(null)
			const n = await updateNote(note.id, { archived })
			setNote(n)
		} catch (e) {
			setError(
				e instanceof Error
					? e.message
					: "Could not update archive state",
			)
		}
	}

	const handleDeleteNote = async () => {
		if (!note) return
		const label = note.title?.trim() || "Untitled"
		if (
			!window.confirm(
				`Permanently delete “${label}”? All sections and follow-ups will be removed. This cannot be undone.`,
			)
		) {
			return
		}
		try {
			setError(null)
			await deleteNote(note.id)
			navigate({ to: "/notes" })
		} catch (e) {
			let msg = "Could not delete note"
			if (
				e instanceof ApiError &&
				e.body &&
				typeof e.body === "object"
			) {
				const d = e.body as { detail?: unknown }
				if (d.detail) msg = String(d.detail)
			} else if (e instanceof Error) msg = e.message
			setError(msg)
		}
	}

	const toggleNoteTask = async (t: NoteTaskOut) => {
		if (!note) return
		try {
			setError(null)
			const n = await patchNoteTask(note.id, t.id, { done: !t.done })
			setNote(n)
		} catch (e) {
			let msg = "Could not update task"
			if (
				e instanceof ApiError &&
				e.body &&
				typeof e.body === "object"
			) {
				const d = e.body as { detail?: unknown }
				if (d.detail) msg = String(d.detail)
			} else if (e instanceof Error) msg = e.message
			setError(msg)
		}
	}

	const startEditingTask = useCallback((t: NoteTaskOut) => {
		setEditingTaskId(t.id)
		setTaskEditTitle(t.title)
		setTaskEditDueLocal(dueAtToDatetimeLocalValue(t.due_at))
	}, [])

	const cancelEditingTask = useCallback(() => {
		setEditingTaskId(null)
	}, [])

	const saveEditingTask = useCallback(
		async (t: NoteTaskOut) => {
			if (!note) return
			const trimmed = taskEditTitle.trim()
			if (!trimmed) {
				setError("Follow-up text cannot be empty")
				return
			}
			const body: { title?: string; due_at?: string | null } = {}
			if (trimmed !== t.title) body.title = trimmed
			const newDueIso = datetimeLocalValueToIsoUtc(taskEditDueLocal)
			if (!dueInstantsEqual(t.due_at, newDueIso)) {
				body.due_at = newDueIso
			}
			if (Object.keys(body).length === 0) {
				setEditingTaskId(null)
				return
			}
			try {
				setError(null)
				const n = await patchNoteTask(note.id, t.id, body)
				setNote(n)
				setEditingTaskId(null)
			} catch (e) {
				let msg = "Could not update task"
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
			}
		},
		[note, taskEditTitle, taskEditDueLocal],
	)

	const saveChunk = async (c: ChunkOut, bodyMd: string) => {
		try {
			await updateChunk(c.id, { body_md: bodyMd })
			setEditingChunkId(null)
			await load()
		} catch (e) {
			setError(e instanceof Error ? e.message : "Chunk save failed")
		}
	}

	const addChunk = async () => {
		if (!note) return
		try {
			setEditingTitle(false)
			const created = await createChunk(note.id, { body_md: "" })
			await load()
			setEditingChunkId(created.id)
		} catch (e) {
			setError(e instanceof Error ? e.message : "Add chunk failed")
		}
	}

	const removeChunk = async (c: ChunkOut) => {
		if (!note) return
		if (!window.confirm("Delete this section?")) return
		try {
			setEditingChunkId(null)
			await deleteChunk(c.id)
			await load()
		} catch (e) {
			setError(e instanceof Error ? e.message : "Delete failed")
		}
	}

	const { openFollowUps, doneFollowUps } = useMemo(
		() => partitionNoteTasks(note?.tasks),
		[note],
	)

	useEffect(() => {
		setTaskOpenSkip((s) =>
			clampTaskSkip(s, openFollowUps.length, TASK_PAGE_SIZE),
		)
	}, [openFollowUps.length])

	useEffect(() => {
		setTaskDoneSkip((s) =>
			clampTaskSkip(s, doneFollowUps.length, TASK_PAGE_SIZE),
		)
	}, [doneFollowUps.length])

	useEffect(() => {
		if (taskListView === "done" && doneFollowUps.length === 0) {
			setTaskListView("active")
		}
	}, [taskListView, doneFollowUps.length])

	if (!mounted || !authChecked || !loggedIn) return null

	const openTaskSkipEff = clampTaskSkip(
		taskOpenSkip,
		openFollowUps.length,
		TASK_PAGE_SIZE,
	)
	const doneTaskSkipEff = clampTaskSkip(
		taskDoneSkip,
		doneFollowUps.length,
		TASK_PAGE_SIZE,
	)
	const openTasksPage = openFollowUps.slice(
		openTaskSkipEff,
		openTaskSkipEff + TASK_PAGE_SIZE,
	)
	const doneTasksPage = doneFollowUps.slice(
		doneTaskSkipEff,
		doneTaskSkipEff + TASK_PAGE_SIZE,
	)

	const sortedChunks = note
		? [...note.chunks].sort(
				(a, b) =>
					a.sort_order - b.sort_order ||
					a.created_ts.localeCompare(b.created_ts),
		  )
		: []

	const displayTitle = note?.title?.trim() || "Untitled"

	return (
		<HomeLayout>
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 pt-4 pb-10">
				<nav className="flex items-center justify-between gap-3 text-sm">
					<Link
						to="/notes"
						className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.08] px-3.5 py-1.5 font-medium text-primary transition-colors hover:border-primary/40 hover:bg-primary/[0.14] dark:border-primary/35 dark:bg-primary/15 dark:hover:bg-primary/25"
					>
						<span aria-hidden className="text-lg leading-none">
							←
						</span>
						All notes
					</Link>
					<div className="flex shrink-0 flex-wrap justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="border-sky-300/70 text-sky-950 hover:bg-sky-50 dark:border-sky-600 dark:text-sky-100 dark:hover:bg-sky-950/50"
							disabled={loading && !note}
							onClick={() => {
								setHistoryOpen(true)
								void loadHistory(0)
							}}
						>
							History
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="border-violet-300/70 text-violet-950 hover:bg-violet-50 dark:border-violet-600 dark:text-violet-100 dark:hover:bg-violet-950/50"
							disabled={loading && !note}
							onClick={() => openIncomingUpdatesModal(null)}
						>
							Incoming updates
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="border-emerald-300/70 text-emerald-950 hover:bg-emerald-50 dark:border-emerald-600 dark:text-emerald-100 dark:hover:bg-emerald-950/45"
							disabled={loading && !note}
							onClick={() => void addChunk()}
						>
							Add section
						</Button>
					</div>
				</nav>

				<Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
					<DialogContent className="flex max-h-[min(85vh,40rem)] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
						<div className="border-b border-border px-6 pb-4 pr-14 pt-6">
							<DialogHeader className="space-y-2 text-left">
								<DialogTitle>Change history</DialogTitle>
								<DialogDescription>
									Newest first. Each row compares to the prior
									snapshot of the same kind (note metadata or
									section body)—additions in green, removals in
									red, like Git.
								</DialogDescription>
							</DialogHeader>
						</div>
						<div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
							{historyLoading ? (
								<p className="text-sm text-muted-foreground">
									Loading…
								</p>
							) : null}
							{historyError ? (
								<p
									role="alert"
									className="text-sm text-red-600 dark:text-red-400"
								>
									{historyError}
								</p>
							) : null}
							{!historyLoading &&
							!historyError &&
							historyLoaded &&
							historyEvents.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									No recorded changes yet.
								</p>
							) : null}
							{historyEvents.length > 0 ? (
								<ol className="space-y-4">
									{historyEvents.map((ev, i) => (
										<li
											key={`${ev.kind}-${ev.id}`}
											className="border-b border-border pb-4 last:border-b-0 last:pb-0"
										>
											{ev.kind === "note" ? (
												<NoteHistoryRow
													event={ev}
													before={findPreviousNoteEvent(
														historyEvents,
														i,
													)}
												/>
											) : ev.kind === "task" ? (
												<TaskHistoryRow
													event={ev}
													previous={findPreviousTaskEvent(
														historyEvents,
														i,
														ev.task_id,
													)}
													onViewIncomingUpdate={
														openIncomingUpdatesModal
													}
												/>
											) : (
												<ChunkHistoryRow
													event={ev}
													previous={findPreviousChunkEvent(
														historyEvents,
														i,
														ev.chunk_id,
													)}
												/>
											)}
										</li>
									))}
								</ol>
							) : null}
						</div>
						<HistoryPaginationFooter
							total={historyTotal}
							skip={historySkip}
							pageItemCount={historyEvents.length}
							loading={historyLoading}
							pageSize={HISTORY_PAGE_SIZE}
							onPrev={() =>
								void loadHistory(
									Math.max(
										0,
										historySkip - HISTORY_PAGE_SIZE,
									),
								)
							}
							onNext={() =>
								void loadHistory(
									historySkip + HISTORY_PAGE_SIZE,
								)
							}
						/>
					</DialogContent>
				</Dialog>

				<Dialog
					open={incomingUpdatesOpen}
					onOpenChange={(open) => {
						setIncomingUpdatesOpen(open)
						if (!open) {
							setIncomingHighlightId(null)
							setIncomingUpdatesChunkId(null)
						}
					}}
				>
					<DialogContent className="flex max-h-[min(85vh,44rem)] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
						<div className="border-b border-border px-6 pb-4 pr-14 pt-6">
							<DialogHeader className="space-y-2 text-left">
								<DialogTitle>
									{incomingUpdatesChunkId
										? "Section incoming updates"
										: "Incoming updates"}
								</DialogTitle>
								<DialogDescription>
									{incomingUpdatesChunkId
										? "Merge submissions that changed this section (newest first)."
										: "Raw text submitted for merge into this note (workflow or API), newest first."}
								</DialogDescription>
							</DialogHeader>
						</div>
						<div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
							{incomingUpdatesLoading ? (
								<p className="text-sm text-muted-foreground">
									Loading…
								</p>
							) : null}
							{incomingUpdatesError ? (
								<p
									role="alert"
									className="text-sm text-red-600 dark:text-red-400"
								>
									{incomingUpdatesError}
								</p>
							) : null}
							{!incomingUpdatesLoading &&
							!incomingUpdatesError &&
							incomingUpdatesList.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									{incomingUpdatesChunkId
										? "No incoming updates are linked to this section yet."
										: "No incoming updates are linked to this note yet."}
								</p>
							) : null}
							{incomingUpdatesList.length > 0 ? (
								<ol className="space-y-6">
									{incomingUpdatesList.map((u) => (
										<li
											key={u.id}
											id={`incoming-update-${u.id}`}
											className={`scroll-mt-4 rounded-lg border border-border bg-card p-4 shadow-sm ${
												incomingHighlightId === u.id
													? "ring-2 ring-primary ring-offset-2 ring-offset-background"
													: ""
											}`}
										>
											<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
												<p className="text-xs text-muted-foreground">
													{formatUpdated(u.created_ts)}
												</p>
												<span
													className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${incomingUpdateStatusClass(u.status)}`}
												>
													{u.status}
												</span>
											</div>
											{u.error_message ? (
												<p
													role="status"
													className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100"
												>
													{u.error_message}
												</p>
											) : null}
											<div className="rounded-md border border-border bg-muted/20 p-3">
												<MarkdownPreview
													source={
														u.body_md.trim()
															? u.body_md
															: "*No body.*"
													}
													framed={false}
												/>
											</div>
										</li>
									))}
								</ol>
							) : null}
						</div>
					</DialogContent>
				</Dialog>

				<FollowUpSourceModal
					noteId={noteId}
					updateId={followUpSourceId}
					open={followUpSourceId != null}
					onOpenChange={(open) => {
						if (!open) setFollowUpSourceId(null)
					}}
				/>

				<Dialog
					open={sectionHistoryOpen}
					onOpenChange={(open) => {
						setSectionHistoryOpen(open)
						if (!open) {
							setSectionHistoryChunkId(null)
							setSectionHistoryLoaded(false)
							setSectionHistoryEvents([])
							setSectionHistorySkip(0)
							setSectionHistoryTotal(0)
							setSectionHistoryError(null)
						}
					}}
				>
					<DialogContent className="flex max-h-[min(85vh,40rem)] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
						<div className="border-b border-border px-6 pb-4 pr-14 pt-6">
							<DialogHeader className="space-y-2 text-left">
								<DialogTitle>Section history</DialogTitle>
								<DialogDescription>
									Newest first. Body text is diffed against the
									previous snapshot for this section (green /
									red).
								</DialogDescription>
							</DialogHeader>
						</div>
						<div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
							{sectionHistoryLoading ? (
								<p className="text-sm text-muted-foreground">
									Loading…
								</p>
							) : null}
							{sectionHistoryError ? (
								<p
									role="alert"
									className="text-sm text-red-600 dark:text-red-400"
								>
									{sectionHistoryError}
								</p>
							) : null}
							{!sectionHistoryLoading &&
							!sectionHistoryError &&
							sectionHistoryLoaded &&
							sectionHistoryEvents.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									No history recorded for this section yet.
								</p>
							) : null}
							{sectionHistoryEvents.length > 0 ? (
								<ol className="space-y-4">
									{sectionHistoryEvents.map((ev, i) => (
										<li
											key={ev.id}
											className="border-b border-border pb-4 last:border-b-0 last:pb-0"
										>
											<ChunkHistoryRow
												event={ev}
												previous={
													i + 1 <
													sectionHistoryEvents.length
														? sectionHistoryEvents[
																i + 1
														  ] ?? null
														: null
												}
											/>
										</li>
									))}
								</ol>
							) : null}
						</div>
						{sectionHistoryChunkId ? (
							<HistoryPaginationFooter
								total={sectionHistoryTotal}
								skip={sectionHistorySkip}
								pageItemCount={sectionHistoryEvents.length}
								loading={sectionHistoryLoading}
								pageSize={HISTORY_PAGE_SIZE}
								onPrev={() =>
									void loadSectionHistory(
										sectionHistoryChunkId,
										Math.max(
											0,
											sectionHistorySkip -
												HISTORY_PAGE_SIZE,
										),
									)
								}
								onNext={() =>
									void loadSectionHistory(
										sectionHistoryChunkId,
										sectionHistorySkip + HISTORY_PAGE_SIZE,
									)
								}
							/>
						) : null}
					</DialogContent>
				</Dialog>

				{loading && !note ? (
					<div className="space-y-4 animate-pulse">
						<div className="h-10 w-2/3 rounded-lg bg-muted" />
						<div className="h-4 w-40 rounded bg-muted" />
						<div className="mt-6 space-y-2">
							<div className="h-4 w-full rounded bg-muted" />
							<div className="h-4 w-full rounded bg-muted" />
							<div className="h-4 w-4/5 rounded bg-muted" />
						</div>
					</div>
				) : note ? (
					<>
						{note.archived ? (
							<div
								className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900/60 dark:bg-amber-950/40"
								role="status"
							>
								<p className="text-sm text-amber-950 dark:text-amber-50">
									This note is archived and hidden from your
									main list.
								</p>
								<div>
									<Button
										type="button"
										size="sm"
										variant="secondary"
										onClick={() => void saveArchived(false)}
									>
										Restore to notes
									</Button>
								</div>
							</div>
						) : null}

						<header className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.09] via-card/80 to-chart-4/[0.12] p-5 shadow-sm dark:from-primary/[0.14] dark:via-card/60 dark:to-chart-2/25 md:p-6">
							{editingTitle ? (
								<div className="space-y-3">
									<label
										htmlFor="note-title-edit"
										className="text-sm font-medium text-muted-foreground"
									>
										Title
									</label>
									<input
										id="note-title-edit"
										value={title}
										onChange={(e) =>
											setTitle(e.target.value)
										}
										className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-lg"
									/>
									<label
										htmlFor="note-summary-edit"
										className="text-sm font-medium text-muted-foreground"
									>
										Summary
									</label>
									<textarea
										id="note-summary-edit"
										value={summary}
										onChange={(e) =>
											setSummary(e.target.value)
										}
										rows={4}
										placeholder="Short plain-text summary (optional)"
										className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-sm leading-relaxed"
									/>
									<div className="flex flex-wrap gap-2">
										<Button
											type="button"
											size="sm"
											onClick={() => void saveTitle()}
										>
											Save
										</Button>
										<Button
											type="button"
											size="sm"
											variant="ghost"
											onClick={cancelTitleEdit}
										>
											Cancel
										</Button>
									</div>
								</div>
							) : (
								<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
									<div className="min-w-0 flex-1 space-y-1.5">
										<h1 className="text-balance bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-3xl font-semibold leading-tight tracking-tight text-transparent md:text-4xl dark:to-chart-4">
											{displayTitle}
										</h1>
										{note.summary?.trim() ? (
											<p className="max-w-3xl text-pretty text-base leading-relaxed text-muted-foreground">
												{note.summary.trim()}
											</p>
										) : null}
										<p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
											<span className="inline-flex items-center gap-1.5">
												<span
													className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500 dark:bg-sky-400"
													aria-hidden
												/>
												Updated{" "}
												{formatUpdated(note.updated_ts)}
											</span>
											{note.archived ? (
												<span className="inline-flex items-center gap-1.5 text-amber-800 dark:text-amber-200">
													<span
														className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
														aria-hidden
													/>
													Archived
												</span>
											) : null}
											{sortedChunks.length > 1 ? (
												<span className="inline-flex items-center gap-1.5">
													<span
														className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500 dark:bg-violet-400"
														aria-hidden
													/>
													{sortedChunks.length}{" "}
													sections
												</span>
											) : null}
										</p>
									</div>
									<div className="flex shrink-0 flex-col items-stretch gap-2 self-start sm:items-end">
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => {
												setEditingChunkId(null)
												if (note) {
													setTitle(note.title ?? "")
													setSummary(
														note.summary ?? "",
													)
												}
												setEditingTitle(true)
											}}
										>
											Edit title
										</Button>
										{!note.archived ? (
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="text-muted-foreground hover:text-foreground"
												onClick={() =>
													void saveArchived(true)
												}
											>
												Archive note
											</Button>
										) : null}
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="text-destructive hover:bg-destructive/10 hover:text-destructive"
											onClick={() => void handleDeleteNote()}
										>
											Delete note
										</Button>
									</div>
								</div>
							)}
						</header>

						{note && (note.tasks?.length ?? 0) > 0 ? (
							<section
								className="rounded-xl border border-teal-200/70 bg-gradient-to-br from-teal-50/90 via-card to-card p-3.5 shadow-sm dark:border-teal-800/50 dark:from-teal-950/40 dark:via-card dark:to-card"
								aria-label="Follow-up tasks"
							>
								<div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
									<div className="min-w-0 flex-1">
										<h2 className="mb-0.5 text-sm font-semibold tracking-wide text-teal-900 dark:text-teal-100">
											Follow-up tasks
										</h2>
										<p className="text-xs text-muted-foreground">
											Merge workflows can change note sections or
											this list. You can edit a follow-up's text
											and due date; optional links to the incoming
											update appear when the model provides them.
										</p>
									</div>
									{doneFollowUps.length > 0 ? (
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="shrink-0 self-end sm:mt-0.5 sm:self-start"
											aria-pressed={taskListView === "done"}
											onClick={() =>
												setTaskListView((v) =>
													v === "active" ? "done" : "active",
												)
											}
										>
											{taskListView === "active"
												? `Done tasks (${doneFollowUps.length})`
												: `Active tasks (${openFollowUps.length})`}
										</Button>
									) : null}
								</div>

								{taskListView === "active" ? (
									openFollowUps.length > 0 ? (
										<div className="space-y-2">
											<p className="text-[11px] font-medium uppercase tracking-wide text-teal-800/80 dark:text-teal-200/90">
												Open
											</p>
											<ul className="space-y-2">
												{openTasksPage.map((t) => {
													const dueLabel = formatDueRelative(
														t.due_at,
													)
													const dueTitle =
														formatDueAbsoluteTitle(t.due_at)
													const dueSoon =
														isDueWithinTwentyFourHours(t.due_at)
													const isEditing = editingTaskId === t.id
													return (
														<li key={t.id}>
															<div className="flex flex-col gap-2 rounded-md border border-transparent px-1 py-1 hover:border-border">
																<div className="flex items-start justify-between gap-2">
																	{isEditing ? (
																		<div className="min-w-0 flex-1 space-y-2">
																			<textarea
																				value={taskEditTitle}
																				onChange={(e) =>
																					setTaskEditTitle(
																						e.target.value,
																					)
																				}
																				rows={3}
																				className="w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
																			/>
																			<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
																				<label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
																					<span>
																						Due (optional)
																					</span>
																					<input
																						type="datetime-local"
																						value={
																							taskEditDueLocal
																						}
																						onChange={(e) =>
																							setTaskEditDueLocal(
																								e.target
																									.value,
																							)
																						}
																						className="w-full min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring sm:max-w-xs"
																					/>
																				</label>
																				<Button
																					type="button"
																					variant="outline"
																					size="sm"
																					className="w-fit shrink-0"
																					onClick={() =>
																						setTaskEditDueLocal(
																							"",
																						)
																					}
																				>
																					Clear due
																				</Button>
																			</div>
																			<div className="flex flex-wrap gap-2">
																				<Button
																					type="button"
																					size="sm"
																					onClick={() =>
																						void saveEditingTask(
																							t,
																						)
																					}
																				>
																					Save
																				</Button>
																				<Button
																					type="button"
																					variant="outline"
																					size="sm"
																					onClick={
																						cancelEditingTask
																					}
																				>
																					Cancel
																				</Button>
																			</div>
																		</div>
																	) : (
																		<label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
																			<input
																				type="checkbox"
																				className="mt-1 h-4 w-4 shrink-0 rounded border-input"
																				checked={t.done}
																				onChange={() =>
																					void toggleNoteTask(
																						t,
																					)
																				}
																			/>
																			<span className="min-w-0 text-sm leading-relaxed text-foreground">
																				<span className="block">
																					{t.title}
																				</span>
																				{dueLabel ? (
																					<span
																						className={
																							dueSoon
																								? "mt-1.5 inline-flex w-fit max-w-full items-center rounded-md border border-red-400/50 bg-red-500/15 px-2.5 py-1 text-sm font-bold tracking-tight text-red-900 shadow-sm dark:border-red-700/50 dark:bg-red-950/40 dark:text-red-50"
																								: "mt-1.5 inline-flex w-fit max-w-full items-center rounded-md border border-teal-300/60 bg-teal-500/12 px-2.5 py-1 text-sm font-bold tracking-tight text-teal-950 shadow-sm dark:border-teal-700/45 dark:bg-teal-950/35 dark:text-teal-50"
																						}
																						title={
																							dueTitle ??
																							undefined
																						}
																					>
																						Due {dueLabel}
																					</span>
																				) : null}
																			</span>
																		</label>
																	)}
																	{note ? (
																		<div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-start">
																			{!isEditing ? (
																				<Button
																					type="button"
																					variant="ghost"
																					size="sm"
																					className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
																					onClick={() =>
																						startEditingTask(
																							t,
																						)
																					}
																				>
																					Edit
																				</Button>
																			) : null}
																			<FollowUpSourceButton
																				updateId={
																					t.external_note_update_id
																				}
																				onViewSource={(id) =>
																					setFollowUpSourceId(
																						id,
																					)
																				}
																				className="mt-0.5"
																			/>
																		</div>
																	) : null}
																</div>
															</div>
														</li>
													)
												})}
											</ul>
											{openFollowUps.length > TASK_PAGE_SIZE ? (
												<HistoryPaginationFooter
													total={openFollowUps.length}
													skip={openTaskSkipEff}
													pageItemCount={openTasksPage.length}
													loading={false}
													pageSize={TASK_PAGE_SIZE}
													onPrev={() =>
														setTaskOpenSkip((s) =>
															Math.max(
																0,
																s - TASK_PAGE_SIZE,
															),
														)
													}
													onNext={() =>
														setTaskOpenSkip((s) =>
															Math.min(
																Math.max(
																	0,
																	(Math.ceil(
																		openFollowUps.length /
																			TASK_PAGE_SIZE,
																	) -
																		1) *
																		TASK_PAGE_SIZE,
																),
																s + TASK_PAGE_SIZE,
															),
														)
													}
												/>
											) : null}
										</div>
									) : (
										<p className="text-xs text-muted-foreground">
											No open follow-ups.
										</p>
									)
								) : doneFollowUps.length > 0 ? (
									<div className="space-y-2">
										<p className="text-[11px] font-medium uppercase tracking-wide text-teal-800/80 dark:text-teal-200/90">
											Done
										</p>
										<ul className="space-y-2">
											{doneTasksPage.map((t) => {
												const dueLabel = formatDueRelative(t.due_at)
												const dueTitle =
													formatDueAbsoluteTitle(t.due_at)
												const isEditing = editingTaskId === t.id
												return (
													<li key={t.id}>
														<div className="flex flex-col gap-2 rounded-md border border-transparent px-1 py-1 hover:border-border">
															<div className="flex items-start justify-between gap-2">
																{isEditing ? (
																	<div className="min-w-0 flex-1 space-y-2">
																		<textarea
																			value={taskEditTitle}
																			onChange={(e) =>
																				setTaskEditTitle(
																					e.target.value,
																				)
																			}
																			rows={3}
																			className="w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
																		/>
																		<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
																			<label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
																				<span>Due (optional)</span>
																				<input
																					type="datetime-local"
																					value={taskEditDueLocal}
																					onChange={(e) =>
																						setTaskEditDueLocal(
																							e.target.value,
																						)
																					}
																					className="w-full min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring sm:max-w-xs"
																				/>
																			</label>
																			<Button
																				type="button"
																				variant="outline"
																				size="sm"
																				className="w-fit shrink-0"
																				onClick={() =>
																					setTaskEditDueLocal("")
																				}
																			>
																				Clear due
																			</Button>
																		</div>
																		<div className="flex flex-wrap gap-2">
																			<Button
																				type="button"
																				size="sm"
																				onClick={() =>
																					void saveEditingTask(t)
																				}
																			>
																				Save
																			</Button>
																			<Button
																				type="button"
																				variant="outline"
																				size="sm"
																				onClick={cancelEditingTask}
																			>
																				Cancel
																			</Button>
																		</div>
																	</div>
																) : (
																	<label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
																		<input
																			type="checkbox"
																			className="mt-1 h-4 w-4 shrink-0 rounded border-input"
																			checked={t.done}
																			onChange={() =>
																				void toggleNoteTask(t)
																			}
																		/>
																		<span className="min-w-0 text-sm leading-relaxed text-muted-foreground">
																			<span className="block line-through">
																				{t.title}
																			</span>
																			{dueLabel ? (
																				<span
																					className="mt-1.5 inline-flex w-fit max-w-full rounded-md border border-border bg-muted/60 px-2.5 py-1 text-sm font-bold tracking-tight text-foreground/90 shadow-sm"
																					title={
																						dueTitle ??
																						undefined
																					}
																				>
																					Was due {dueLabel}
																				</span>
																			) : null}
																		</span>
																	</label>
																)}
																{note ? (
																	<div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-start">
																		{!isEditing ? (
																			<Button
																				type="button"
																				variant="ghost"
																				size="sm"
																				className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
																				onClick={() =>
																					startEditingTask(t)
																				}
																			>
																				Edit
																			</Button>
																		) : null}
																		<FollowUpSourceButton
																			updateId={
																				t.external_note_update_id
																			}
																			onViewSource={(id) =>
																				setFollowUpSourceId(id)
																			}
																			className="mt-0.5"
																		/>
																	</div>
																) : null}
															</div>
														</div>
													</li>
												)
											})}
										</ul>
										{doneFollowUps.length > TASK_PAGE_SIZE ? (
											<HistoryPaginationFooter
												total={doneFollowUps.length}
												skip={doneTaskSkipEff}
												pageItemCount={doneTasksPage.length}
												loading={false}
												pageSize={TASK_PAGE_SIZE}
												onPrev={() =>
													setTaskDoneSkip((s) =>
														Math.max(
															0,
															s - TASK_PAGE_SIZE,
														),
													)
												}
												onNext={() =>
													setTaskDoneSkip((s) =>
														Math.min(
															Math.max(
																0,
																(Math.ceil(
																	doneFollowUps.length /
																		TASK_PAGE_SIZE,
																) -
																	1) *
																	TASK_PAGE_SIZE,
															),
															s + TASK_PAGE_SIZE,
														),
													)
												}
											/>
										) : null}
									</div>
								) : (
									<p className="text-xs text-muted-foreground">
										No completed follow-ups.
									</p>
								)}
							</section>
						) : null}

						{sortedChunks.length === 0 ? (
							<div className="rounded-xl border border-dashed border-violet-300/60 bg-gradient-to-br from-violet-50/70 via-sky-50/40 to-amber-50/50 px-5 py-8 text-center dark:border-violet-700/50 dark:from-violet-950/35 dark:via-sky-950/25 dark:to-amber-950/20">
								<p className="text-muted-foreground">
									No sections yet. Use{" "}
									<span className="font-semibold text-violet-700 dark:text-violet-300">
										Add section
									</span>{" "}
									above to write in markdown.
								</p>
							</div>
						) : (
							<div className="flex flex-col gap-2">
								{sortedChunks.map((c, chunkIndex) => (
									<ChunkBlock
										key={c.id}
										accentClassName={
											SECTION_ACCENT_BAR[
												chunkIndex %
													SECTION_ACCENT_BAR.length
											]
										}
										chunk={c}
										isEditing={editingChunkId === c.id}
										onStartEdit={() => {
											setEditingTitle(false)
											setEditingChunkId(c.id)
										}}
										onCancelEdit={() =>
											setEditingChunkId(null)
										}
										onSave={(md) => void saveChunk(c, md)}
										onDelete={() => void removeChunk(c)}
										onSectionHistory={() => {
											setSectionHistoryChunkId(c.id)
											setSectionHistoryOpen(true)
											void loadSectionHistory(c.id, 0)
										}}
										onViewLinkedUpdate={
											c.external_note_update_id
												? () =>
														void openIncomingUpdatesModal(
															c.external_note_update_id,
															c.id,
														)
												: undefined
										}
									/>
								))}
							</div>
						)}
					</>
				) : null}

				{error && (
					<div
						role="alert"
						className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
					>
						{error}
					</div>
				)}
			</div>
		</HomeLayout>
	)
}

function taskDoneLabel(done: boolean) {
	return done ? "Done" : "Open"
}

function TaskHistoryRow({
	event,
	previous,
	onViewIncomingUpdate,
}: {
	event: TaskHistoryEvent
	previous: TaskHistoryEvent | null
	onViewIncomingUpdate?: (updateId: string | null) => void
}) {
	const label = event.deleted ? "Follow-up removed" : "Follow-up task"
	const prevTitle =
		previous && !previous.deleted ? (previous.title ?? "") : ""
	const curTitle = event.deleted ? "" : (event.title ?? "")
	const titleChanged = prevTitle !== curTitle
	const doneChangedTight =
		previous == null ||
		(previous != null && !event.deleted && previous.done !== event.done) ||
		(event.deleted && previous != null)
	const prevDueLabel = formatDueRelative(
		previous && !previous.deleted ? previous.due_at : null,
	)
	const curDueLabel = formatDueRelative(event.deleted ? null : event.due_at)
	const dueChanged = (prevDueLabel ?? "") !== (curDueLabel ?? "")
	const sortChanged =
		previous != null && previous.sort_order !== event.sort_order
	const anyChange =
		titleChanged ||
		doneChangedTight ||
		dueChanged ||
		sortChanged
	return (
		<div className="space-y-2">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<p className="text-xs text-muted-foreground">
					{formatUpdated(event.changed_ts)} · {label}
					<span className="text-muted-foreground/80">
						{" "}
						· order {event.sort_order}
						{!event.deleted && event.done ? " · Done" : null}
					</span>
					{event.external_note_update_id ? (
						<span className="text-muted-foreground/80">
							{" "}
							· From incoming update
						</span>
					) : null}
				</p>
				{event.external_note_update_id && onViewIncomingUpdate ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-7 shrink-0 px-2 text-xs"
						onClick={() =>
							onViewIncomingUpdate(event.external_note_update_id!)
						}
					>
						View update
					</Button>
				) : null}
			</div>
			{titleChanged ? (
				<div className="space-y-1">
					<p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
						Title
					</p>
					<LineDiffBlock before={prevTitle} after={curTitle} />
				</div>
			) : null}
			{doneChangedTight ? (
				<div className="space-y-1">
					<p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
						Status
					</p>
					<LineDiffBlock
						before={
							previous == null
								? ""
								: taskDoneLabel(previous.done)
						}
						after={event.deleted ? "" : taskDoneLabel(event.done)}
					/>
				</div>
			) : null}
			{dueChanged ? (
				<div className="space-y-1">
					<p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
						Due
					</p>
					<LineDiffBlock
						before={prevDueLabel ?? ""}
						after={curDueLabel ?? ""}
					/>
				</div>
			) : null}
			{sortChanged ? (
				<div className="space-y-1">
					<p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
						Order
					</p>
					<LineDiffBlock
						before={String(previous.sort_order)}
						after={String(event.sort_order)}
					/>
				</div>
			) : null}
			{!anyChange ? (
				<p className="text-xs text-muted-foreground">
					No field changes in this row.
				</p>
			) : null}
		</div>
	)
}

function NoteHistoryRow({
	event,
	before,
}: {
	event: NoteHistoryEvent
	before: NoteHistoryEvent | null
}) {
	const prevTitle = before?.title ?? ""
	const prevSummary = before?.summary ?? ""
	const prevArchived = before?.archived ?? false
	const curTitle = event.title ?? ""
	const curSummary = event.summary ?? ""
	const titleChanged = prevTitle !== curTitle
	const summaryChanged = prevSummary !== curSummary
	const archivedChanged = prevArchived !== event.archived
	const displayTitle = event.title?.trim() || "Untitled"
	return (
		<div className="space-y-2">
			<p className="text-xs text-muted-foreground">
				{formatUpdated(event.changed_ts)} · Note
				{event.external_note_update_id ? (
					<span className="text-muted-foreground/80">
						{" "}
						· Incoming update
					</span>
				) : null}
			</p>
			<p className="text-sm text-foreground">
				<span className="font-medium">{displayTitle}</span>
				<span className="text-muted-foreground">
					{" "}
					· {event.archived ? "Archived" : "Active"}
				</span>
			</p>
			{titleChanged ? (
				<div className="space-y-1">
					<p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
						Title
					</p>
					<LineDiffBlock before={prevTitle} after={curTitle} />
				</div>
			) : null}
			{summaryChanged ? (
				<div className="space-y-1">
					<p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
						Summary
					</p>
					<LineDiffBlock before={prevSummary} after={curSummary} />
				</div>
			) : null}
			{archivedChanged ? (
				<div className="space-y-1">
					<p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
						Archive state
					</p>
					<LineDiffBlock
						before={prevArchived ? "Archived" : "Active"}
						after={event.archived ? "Archived" : "Active"}
					/>
				</div>
			) : null}
			{!titleChanged && !summaryChanged && !archivedChanged ? (
				<p className="text-xs text-muted-foreground">
					No field changes in this row.
				</p>
			) : null}
		</div>
	)
}

function ChunkHistoryRow({
	event,
	previous,
}: {
	event: ChunkHistoryEvent
	previous: ChunkHistoryEvent | null
}) {
	const label = event.deleted ? "Section removed" : "Section saved"
	const { before, after } = chunkHistoryDiffText(event, previous)
	const metaChanged =
		previous != null &&
		(previous.sort_order !== event.sort_order ||
			previous.completed !== event.completed)
	const bodyUnchanged = before === after && !event.deleted
	return (
		<div className="space-y-2">
			<p className="text-xs text-muted-foreground">
				{formatUpdated(event.changed_ts)} · {label}
				<span className="text-muted-foreground/80">
					{" "}
					· order {event.sort_order}
					{event.completed ? " · Done" : ""}
				</span>
				{event.external_note_update_id ? (
					<span className="text-muted-foreground/80">
						{" "}
						· Incoming update
					</span>
				) : null}
			</p>
			{metaChanged && bodyUnchanged && previous ? (
				<p className="text-xs text-muted-foreground">
					Order or completion changed; body text unchanged.
					{previous.sort_order !== event.sort_order
						? ` Order ${previous.sort_order}→${event.sort_order}.`
						: null}
				</p>
			) : null}
			<div className="space-y-1">
				<p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
					Body
				</p>
				<LineDiffBlock before={before} after={after} />
			</div>
		</div>
	)
}

function ChunkBlock({
	accentClassName,
	chunk,
	isEditing,
	onStartEdit,
	onCancelEdit,
	onSave,
	onDelete,
	onSectionHistory,
	onViewLinkedUpdate,
}: {
	/** Left accent bar color (Tailwind `before:bg-*` classes). */
	accentClassName: string
	chunk: ChunkOut
	isEditing: boolean
	onStartEdit: () => void
	onCancelEdit: () => void
	onSave: (md: string) => void
	onDelete: () => void
	onSectionHistory: () => void
	/** Opens incoming-updates modal for this section’s linked merge, if any. */
	onViewLinkedUpdate?: () => void
}) {
	const [draft, setDraft] = useState(chunk.body_md)
	useEffect(() => {
		setDraft(chunk.body_md)
	}, [chunk.id, chunk.body_md, chunk.updated_ts])

	const isEmpty = !chunk.body_md.trim()

	if (isEditing) {
		return (
			<article
				className="scroll-mt-20 rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50/50 via-card to-card p-3 shadow-md transition-colors duration-150 hover:from-sky-50/70 dark:border-sky-800/70 dark:from-sky-950/35 dark:via-card dark:to-card"
				aria-label="Edit section"
			>
				<div className="mb-1.5 flex flex-wrap items-center justify-end gap-1">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="shrink-0"
						onClick={onSectionHistory}
					>
						History
					</Button>
					{onViewLinkedUpdate ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={onViewLinkedUpdate}
						>
							View update
						</Button>
					) : null}
				</div>
				<MarkdownEditor
					variant="chunk"
					value={draft}
					onChange={setDraft}
					preview="edit"
					className="w-full"
				/>
				<div className="mt-3 flex flex-wrap gap-2">
					<Button
						type="button"
						size="sm"
						onClick={() => onSave(draft)}
					>
						Save section
					</Button>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						onClick={() => {
							setDraft(chunk.body_md)
							onCancelEdit()
						}}
					>
						Cancel
					</Button>
					<Button
						type="button"
						size="sm"
						variant="destructive"
						className="ml-auto"
						onClick={onDelete}
					>
						Delete section
					</Button>
				</div>
			</article>
		)
	}

	return (
		<article
			className={`group relative scroll-mt-20 rounded-xl border border-border/80 bg-card/40 py-1.5 pl-5 pr-2 shadow-sm transition-colors duration-150 before:pointer-events-none before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-1 before:rounded-full before:opacity-90 hover:bg-muted/35 sm:py-2.5 sm:pl-6 sm:pr-4 dark:bg-card/25 dark:hover:bg-muted/20 ${accentClassName}`}
			aria-label="Note section"
		>
			<div className="pointer-events-none absolute right-2 top-1.5 z-10 flex justify-end gap-0.5 sm:right-3 sm:top-2">
				<div className="pointer-events-none flex flex-wrap justify-end gap-0.5 rounded-md border border-border/60 bg-card/90 px-0.5 py-0.5 opacity-0 shadow-sm backdrop-blur-sm transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 dark:bg-card/80">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 shrink-0 px-2 text-muted-foreground hover:text-foreground"
						onClick={onSectionHistory}
					>
						History
					</Button>
					{onViewLinkedUpdate ? (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-8 shrink-0 px-2 text-muted-foreground hover:text-foreground"
							onClick={onViewLinkedUpdate}
						>
							View update
						</Button>
					) : null}
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 shrink-0 px-2 text-muted-foreground hover:text-foreground"
						onClick={onStartEdit}
					>
						Edit section
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 shrink-0 px-2 text-muted-foreground hover:text-destructive"
						onClick={onDelete}
					>
						Delete section
					</Button>
				</div>
			</div>
			{isEmpty ? (
				<p className="rounded-lg border border-dashed border-slate-300/70 bg-slate-50/60 px-3 pb-5 pt-11 text-center text-sm text-muted-foreground dark:border-slate-600 dark:bg-slate-950/40">
					This section is empty.
				</p>
			) : (
				<MarkdownPreview
					source={chunk.body_md}
					framed={false}
					className="max-sm:pe-36 sm:pe-44"
				/>
			)}
		</article>
	)
}
