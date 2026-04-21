import {
	type NotesListItem,
	createNote,
	deleteNote,
	listNotes,
} from "@/api/notes"
import { ApiError } from "@/client"
import { NOTES_NEXT_ACTIONS_HEADER_QUERY_KEY } from "@/components/NextActionsHeaderLink"
import { useOpenUpdateNotesModal } from "@/components/UpdateNotesModalContext"
import { HomeLayout } from "@/components/layouts/HomeLayout"
import { Button } from "@/components/ui/button"
import { ensureLoggedIn } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect, useState } from "react"

export const Route = createFileRoute("/notes/")({
	component: NotesPage,
})

const CARD_TOP_ACCENT = [
	"border-t-chart-1",
	"border-t-chart-2",
	"border-t-chart-3",
	"border-t-chart-4",
	"border-t-chart-5",
] as const

function NotesPage() {
	const openUpdateNotesModal = useOpenUpdateNotesModal()
	const [mounted, setMounted] = useState(false)
	const [authChecked, setAuthChecked] = useState(false)
	const [loggedIn, setLoggedIn] = useState(false)
	const [notes, setNotes] = useState<NotesListItem[]>([])
	const [listView, setListView] = useState<"active" | "archived">("active")
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const navigate = useNavigate()
	const queryClient = useQueryClient()

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
			const res = await listNotes({
				archived: listView === "archived",
			})
			setNotes(res.data)
			queryClient.setQueryData(
				NOTES_NEXT_ACTIONS_HEADER_QUERY_KEY,
				res.next_actions ?? [],
			)
		} catch (e) {
			let msg = "Failed to load notes"
			if (e instanceof ApiError && e.body && typeof e.body === "object") {
				const d = e.body as { detail?: unknown }
				if (d.detail) msg = String(d.detail)
			} else if (e instanceof Error) msg = e.message
			setError(msg)
		} finally {
			setLoading(false)
		}
	}, [listView, queryClient])

	useEffect(() => {
		if (mounted && loggedIn) void load()
	}, [mounted, loggedIn, load])

	const handleNewNote = async () => {
		try {
			const n = await createNote({ title: "Untitled" })
			await load()
			navigate({ to: "/notes/$noteId", params: { noteId: n.id } })
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not create note")
		}
	}

	const handleDeleteNote = async (n: NotesListItem) => {
		const label = n.title?.trim() || "Untitled"
		if (
			!window.confirm(
				`Permanently delete “${label}”? All sections and follow-ups will be removed. This cannot be undone.`,
			)
		) {
			return
		}
		try {
			setError(null)
			await deleteNote(n.id)
			await load()
		} catch (e) {
			let msg = "Could not delete note"
			if (e instanceof ApiError && e.body && typeof e.body === "object") {
				const d = e.body as { detail?: unknown }
				if (d.detail) msg = String(d.detail)
			} else if (e instanceof Error) msg = e.message
			setError(msg)
		}
	}

	if (!mounted || !authChecked || !loggedIn) return null

	const formatUpdated = (iso: string) => {
		const d = new Date(iso)
		return d.toLocaleString(undefined, {
			dateStyle: "medium",
			timeStyle: "short",
		})
	}

	return (
		<HomeLayout>
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 pb-10 pt-5">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<div className="min-w-0 flex-1 space-y-2">
						<div>
							<h1 className="bg-gradient-to-r from-foreground via-primary to-chart-4 bg-clip-text text-2xl font-semibold tracking-tight text-transparent dark:from-foreground dark:via-chart-2 dark:to-chart-4">
								Notes
							</h1>
							<p className="mt-1 text-sm text-muted-foreground">
								{loading
									? "Loading…"
									: notes.length === 0
									  ? listView === "archived"
											? "No archived notes"
											: "Start your first note"
									  : `${notes.length} ${
												notes.length === 1
													? "note"
													: "notes"
										  }`}
							</p>
						</div>
						<div
							className="inline-flex rounded-lg border border-primary/15 bg-gradient-to-r from-muted/40 via-primary/[0.07] to-chart-5/[0.08] p-1 dark:border-primary/25 dark:from-muted/25 dark:via-chart-3/10 dark:to-chart-4/10"
							role="tablist"
							aria-label="Note list"
						>
							<button
								type="button"
								role="tab"
								aria-selected={listView === "active"}
								className={cn(
									"rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
									listView === "active"
										? "bg-background text-primary shadow-sm ring-1 ring-primary/15 dark:bg-background/90"
										: "text-muted-foreground hover:text-foreground",
								)}
								onClick={() => setListView("active")}
							>
								Active
							</button>
							<button
								type="button"
								role="tab"
								aria-selected={listView === "archived"}
								className={cn(
									"rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
									listView === "archived"
										? "bg-background text-amber-700 shadow-sm ring-1 ring-amber-500/25 dark:bg-background/90 dark:text-amber-400 dark:ring-amber-500/30"
										: "text-muted-foreground hover:text-foreground",
								)}
								onClick={() => setListView("archived")}
							>
								Archived
							</button>
						</div>
					</div>
					{listView === "active" ? (
						<div className="flex flex-wrap items-center gap-2">
							{openUpdateNotesModal ? (
								<Button
									type="button"
									variant="updateNotes"
									onClick={openUpdateNotesModal}
								>
									Update notes
								</Button>
							) : null}
							<Button
								type="button"
								onClick={() => void handleNewNote()}
							>
								New note
							</Button>
						</div>
					) : null}
				</div>
				{error && (
					<div
						role="alert"
						className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
					>
						{error}
					</div>
				)}
				{loading ? (
					<ul className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
						{Array.from({ length: 6 }).map((_, i) => (
							<li
								key={i}
								className="h-36 animate-pulse rounded-xl border border-border bg-muted/40"
							/>
						))}
					</ul>
				) : notes.length === 0 ? (
					<div className="rounded-xl border border-dashed border-primary/25 bg-gradient-to-br from-primary/[0.06] via-muted/30 to-chart-4/[0.08] px-6 py-12 text-center dark:border-primary/35 dark:from-chart-3/15 dark:via-muted/20 dark:to-chart-2/10">
						<div
							className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-chart-4/30 shadow-inner dark:from-primary/30 dark:to-chart-4/40"
							aria-hidden
						>
							<span className="flex gap-1.5">
								<span
									className={cn(
										"h-2 w-2 rounded-full",
										listView === "archived"
											? "bg-amber-500 dark:bg-amber-400"
											: "bg-chart-1",
									)}
								/>
								<span
									className={cn(
										"h-2 w-2 rounded-full",
										listView === "archived"
											? "bg-amber-600/80 dark:bg-amber-500/90"
											: "bg-chart-4",
									)}
								/>
								<span
									className={cn(
										"h-2 w-2 rounded-full",
										listView === "archived"
											? "bg-amber-700/70 dark:bg-amber-600/80"
											: "bg-chart-2",
									)}
								/>
							</span>
						</div>
						<p className="text-muted-foreground">
							{listView === "archived"
								? "You have no archived notes. Open a note and choose Archive note to move it here."
								: "No notes yet. Create one to get started."}
						</p>
					</div>
				) : (
					<ul className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
						{notes.map((n, i) => {
							const title = n.title?.trim() || "Untitled"
							const topAccent = CARD_TOP_ACCENT[i % CARD_TOP_ACCENT.length]
							return (
								<li key={n.id}>
									<div
										className={cn(
											"group flex h-full min-h-[7.5rem] flex-col overflow-hidden rounded-lg border border-border border-t-2 bg-card text-card-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
											topAccent,
											listView === "archived" &&
												"border-t-amber-500 opacity-95 hover:border-amber-500/40 dark:border-t-amber-500 dark:hover:border-amber-400/50",
										)}
									>
										<Link
											to="/notes/$noteId"
											params={{ noteId: n.id }}
											className="flex flex-1 flex-col gap-2 p-4 text-card-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
										>
											<div className="flex flex-1 flex-col gap-2">
												<div className="flex items-start justify-between gap-2">
													<h2 className="line-clamp-2 min-w-0 flex-1 text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
														{title}
													</h2>
													{(n.pending_task_count ?? 0) > 0 ? (
														<span
															className="shrink-0 rounded-full bg-teal-500/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-teal-900 dark:bg-teal-500/20 dark:text-teal-100"
															aria-label={`${n.pending_task_count} open tasks`}
														>
															{n.pending_task_count}{" "}
															open
														</span>
													) : null}
												</div>
												{n.summary?.trim() ? (
													<p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
														{n.summary.trim()}
													</p>
												) : null}
												<div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-2">
													<time
														className="text-xs text-muted-foreground"
														dateTime={n.updated_ts}
													>
														{formatUpdated(
															n.updated_ts,
														)}
													</time>
													<span
														className="text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary"
														aria-hidden
													>
														Open →
													</span>
												</div>
											</div>
										</Link>
										<div className="flex justify-end border-t border-border/60 bg-muted/15 px-2 py-1.5 dark:bg-muted/10">
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
												onClick={() =>
													void handleDeleteNote(n)
												}
											>
												Delete
											</Button>
										</div>
									</div>
								</li>
							)
						})}
					</ul>
				)}
			</div>
		</HomeLayout>
	)
}
