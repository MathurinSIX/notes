import { type NotesListItem, createNote, listNotes } from "@/api/notes"
import { ApiError } from "@/client"
import { NOTES_NEXT_ACTIONS_HEADER_QUERY_KEY } from "@/components/NextActionsHeaderLink"
import { HomeLayout } from "@/components/layouts/HomeLayout"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
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
	const [mounted, setMounted] = useState(false)
	const [authChecked, setAuthChecked] = useState(false)
	const [loggedIn, setLoggedIn] = useState(false)
	const [notes, setNotes] = useState<NotesListItem[]>([])
	const [listView, setListView] = useState<"active" | "archived">("active")
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [newNoteOpen, setNewNoteOpen] = useState(false)
	const [newTitle, setNewTitle] = useState("")
	const [newDescription, setNewDescription] = useState("")
	const [newNoteSubmitting, setNewNoteSubmitting] = useState(false)
	const [newNoteModalError, setNewNoteModalError] = useState<string | null>(
		null,
	)
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

	const openNewNoteModal = () => {
		setNewNoteModalError(null)
		setNewTitle("")
		setNewDescription("")
		setNewNoteOpen(true)
	}

	const submitNewNote = async () => {
		const title = newTitle.trim()
		if (!title) {
			setNewNoteModalError("Enter a title.")
			return
		}
		const description = newDescription.trim() || null
		setNewNoteSubmitting(true)
		setNewNoteModalError(null)
		try {
			const n = await createNote({ title, description })
			setNewNoteOpen(false)
			setNewTitle("")
			setNewDescription("")
			await load()
			navigate({ to: "/notes/$noteId", params: { noteId: n.id } })
		} catch (e) {
			let msg = "Could not create note"
			if (e instanceof ApiError && e.body && typeof e.body === "object") {
				const d = e.body as { detail?: unknown }
				if (d.detail != null) msg = String(d.detail)
			} else if (e instanceof Error) msg = e.message
			setNewNoteModalError(msg)
		} finally {
			setNewNoteSubmitting(false)
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
			<div className="flex w-full flex-col gap-3 px-3 pb-6 pt-3 sm:px-4">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div
						className="inline-flex rounded-md border border-border bg-muted/30 p-0.5"
						role="tablist"
						aria-label="Note list"
					>
						<button
							type="button"
							role="tab"
							aria-selected={listView === "active"}
							className={cn(
								"rounded px-2.5 py-1 text-xs font-medium transition-colors",
								listView === "active"
									? "bg-background text-foreground shadow-sm"
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
								"rounded px-2.5 py-1 text-xs font-medium transition-colors",
								listView === "archived"
									? "bg-background text-amber-700 shadow-sm dark:text-amber-400"
									: "text-muted-foreground hover:text-foreground",
							)}
							onClick={() => setListView("archived")}
						>
							Archived
						</button>
					</div>
					{listView === "active" ? (
						<Button
							type="button"
							size="sm"
							className="h-7 text-xs"
							onClick={openNewNoteModal}
						>
							New note
						</Button>
					) : null}
				</div>

				<Dialog
					open={newNoteOpen}
					onOpenChange={(open) => {
						setNewNoteOpen(open)
						if (!open) {
							setNewNoteModalError(null)
							setNewTitle("")
							setNewDescription("")
						}
					}}
				>
					<DialogContent
						fullscreen
						className="left-0 top-0 h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 p-0 shadow-none sm:left-0 sm:top-0 sm:rounded-none"
					>
						<div className="flex h-full min-h-0 flex-col">
							<div className="shrink-0 border-b border-border px-4 py-3 pr-14 sm:px-6 sm:py-4 sm:pr-16">
								<DialogTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
									New note
								</DialogTitle>
							</div>
							<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 sm:gap-4 sm:p-6">
								<div className="flex shrink-0 flex-col gap-1.5">
									<label
										htmlFor="new-note-title"
										className="text-sm font-medium text-foreground"
									>
										Title
									</label>
									<input
										type="text"
										id="new-note-title"
										value={newTitle}
										onChange={(e) =>
											setNewTitle(e.target.value)
										}
										disabled={newNoteSubmitting}
										placeholder="Untitled"
										className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:text-base"
										autoFocus
									/>
								</div>
								<div className="flex min-h-0 flex-1 flex-col gap-1.5">
									<label
										htmlFor="new-note-description"
										className="text-sm font-medium text-foreground"
									>
										Description
									</label>
									<textarea
										id="new-note-description"
										value={newDescription}
										onChange={(e) =>
											setNewDescription(e.target.value)
										}
										disabled={newNoteSubmitting}
										placeholder="Optional"
										className="min-h-0 w-full flex-1 resize-y rounded-md border border-input bg-background px-3 py-2.5 text-sm leading-relaxed outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:text-base"
									/>
								</div>
								{newNoteModalError ? (
									<p
										role="alert"
										className="shrink-0 text-sm text-red-600 dark:text-red-400"
									>
										{newNoteModalError}
									</p>
								) : null}
							</div>
							<div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end sm:gap-3 sm:p-6">
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={newNoteSubmitting}
									onClick={() => setNewNoteOpen(false)}
								>
									Cancel
								</Button>
								<Button
									type="button"
									size="sm"
									disabled={newNoteSubmitting}
									onClick={() => void submitNewNote()}
								>
									{newNoteSubmitting ? "Creating…" : "Create"}
								</Button>
							</div>
						</div>
					</DialogContent>
				</Dialog>

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
									<Link
										to="/notes/$noteId"
										params={{ noteId: n.id }}
										className={cn(
											"group flex h-full min-h-[7.5rem] flex-col overflow-hidden rounded-lg border border-border border-t-2 bg-card p-4 text-card-foreground shadow-sm outline-none ring-offset-background transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
											topAccent,
											listView === "archived" &&
												"border-t-amber-500 opacity-95 hover:border-amber-500/40 dark:border-t-amber-500 dark:hover:border-amber-400/50",
										)}
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
												{n.description?.trim() ? (
													<p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
														{n.description.trim()}
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
								</li>
							)
						})}
					</ul>
				)}
			</div>
		</HomeLayout>
	)
}
