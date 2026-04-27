import {
	type NotesListItem,
	type NotesNextAction,
	listNotes,
} from "@/api/notes"
import { ApiError } from "@/client"
import { NOTES_NEXT_ACTIONS_HEADER_QUERY_KEY } from "@/components/NextActionsHeaderLink"
import { HomeLayout } from "@/components/layouts/HomeLayout"
import { ensureLoggedIn } from "@/hooks/useAuth"
import {
	formatDueAbsoluteTitle,
	formatDueRelative,
	isDueOverdue,
	isDueWithinTwentyFourHours,
} from "@/lib/dueDate"
import { cn } from "@/lib/utils"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"

export const Route = createFileRoute("/")({
	component: HomePage,
})

const HOME_RECENT_NOTES = 3
const HOME_NEXT_ACTIONS = 5

const CARD_TOP_ACCENT = [
	"border-t-chart-1",
	"border-t-chart-2",
	"border-t-chart-3",
] as const

function HomePage() {
	const queryClient = useQueryClient()
	const navigate = useNavigate()
	const [mounted, setMounted] = useState(false)
	const [authChecked, setAuthChecked] = useState(false)
	const [loggedIn, setLoggedIn] = useState(false)

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

	const { data, isLoading, error, isFetching } = useQuery({
		queryKey: ["homeDashboard"],
		queryFn: () =>
			listNotes({
				limit: HOME_RECENT_NOTES,
				skip: 0,
				archived: false,
			}),
		enabled: mounted && loggedIn,
		retry: false,
	})

	useEffect(() => {
		if (data?.next_actions != null) {
			queryClient.setQueryData(
				NOTES_NEXT_ACTIONS_HEADER_QUERY_KEY,
				data.next_actions,
			)
		}
	}, [data?.next_actions, queryClient])

	const recentNotes = data?.data ?? []
	const nextActions = useMemo(
		() => (data?.next_actions ?? []).slice(0, HOME_NEXT_ACTIONS),
		[data?.next_actions],
	)

	const errMsg = error
		? error instanceof ApiError &&
			error.body &&
			typeof error.body === "object"
			? String((error.body as { detail?: unknown }).detail ?? "Failed to load")
			: error instanceof Error
				? error.message
				: "Failed to load"
		: null

	const formatUpdated = (iso: string) =>
		new Date(iso).toLocaleString(undefined, {
			dateStyle: "medium",
			timeStyle: "short",
		})

	if (!mounted || !authChecked || !loggedIn) return null

	const loading = isLoading || isFetching

	return (
		<HomeLayout>
			<div className="flex w-full flex-col gap-4 px-3 pb-6 pt-3 sm:px-4">
				{errMsg ? (
					<div
						role="alert"
						className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
					>
						{errMsg}
					</div>
				) : null}

				<section
					className="rounded-xl border border-teal-200/70 bg-gradient-to-br from-teal-50/90 via-card to-card p-4 shadow-sm dark:border-teal-800/50 dark:from-teal-950/40 dark:via-card dark:to-card"
					aria-label="Next actions"
				>
					<div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<h2 className="text-sm font-semibold tracking-wide text-teal-900 dark:text-teal-100">
							Next actions
						</h2>
						<Link
							to="/notes/actions"
							className="text-xs font-medium text-primary underline-offset-4 hover:underline"
						>
							View all actions
						</Link>
					</div>
					{loading ? (
						<div className="h-24 animate-pulse rounded-lg border border-border bg-muted/40" />
					) : nextActions.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No open follow-ups. Open a note to add tasks, or visit{" "}
							<Link
								to="/notes"
								className="font-medium text-primary underline-offset-4 hover:underline"
							>
								Notes
							</Link>
							.
						</p>
					) : (
						<ol className="list-none space-y-2 p-0">
							{nextActions.map((a: NotesNextAction) => (
								<ActionPreviewRow key={`${a.note_id}-${a.task_id}`} a={a} />
							))}
						</ol>
					)}
				</section>

				<section aria-label="Recently updated notes">
					<div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<h2 className="text-sm font-semibold tracking-wide text-foreground">
							Recently updated
						</h2>
						<Link
							to="/notes"
							className="text-xs font-medium text-primary underline-offset-4 hover:underline"
						>
							All notes
						</Link>
					</div>
					{loading ? (
						<ul className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-3">
							{Array.from({ length: 3 }).map((_, i) => (
								<li
									key={i}
									className="h-32 animate-pulse rounded-xl border border-border bg-muted/40"
								/>
							))}
						</ul>
					) : recentNotes.length === 0 ? (
						<div className="rounded-xl border border-dashed border-primary/25 bg-muted/20 px-6 py-10 text-center">
							<p className="text-sm text-muted-foreground">
								No notes yet.{" "}
								<Link
									to="/notes"
									className="font-medium text-primary underline-offset-4 hover:underline"
								>
									Open Notes
								</Link>{" "}
								to create one.
							</p>
						</div>
					) : (
						<ul className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-3">
							{recentNotes.map((n: NotesListItem, i: number) => {
								const title = n.title?.trim() || "Untitled"
								const topAccent = CARD_TOP_ACCENT[i % CARD_TOP_ACCENT.length]
								return (
									<li key={n.id}>
										<Link
											to="/notes/$noteId"
											params={{ noteId: n.id }}
											className={cn(
												"group flex h-full min-h-[6.5rem] flex-col overflow-hidden rounded-lg border border-border border-t-2 bg-card p-4 text-card-foreground shadow-sm outline-none ring-offset-background transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
												topAccent,
											)}
										>
											<h3 className="line-clamp-2 text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
												{title}
											</h3>
											{n.description?.trim() ? (
												<p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
													{n.description.trim()}
												</p>
											) : null}
											<time
												className="mt-auto border-t border-border/60 pt-2 text-xs text-muted-foreground"
												dateTime={n.updated_ts}
											>
												{formatUpdated(n.updated_ts)}
											</time>
										</Link>
									</li>
								)
							})}
						</ul>
					)}
				</section>
			</div>
		</HomeLayout>
	)
}

function ActionPreviewRow({ a }: { a: NotesNextAction }) {
	const dueLabel = formatDueRelative(a.due_at)
	const dueTitle = formatDueAbsoluteTitle(a.due_at)
	const overdue = isDueOverdue(a.due_at)
	const dueSoon = isDueWithinTwentyFourHours(a.due_at)
	const noteTitle = a.note_title?.trim() || "Untitled"

	return (
		<li>
			<Link
				to="/notes/$noteId"
				params={{ noteId: a.note_id }}
				className="flex flex-col gap-1 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
			>
				<div className="min-w-0 flex-1">
					<p className="text-sm font-medium leading-snug text-foreground">
						{a.task_title}
					</p>
					<p className="mt-0.5 truncate text-xs text-muted-foreground">
						<span className="text-muted-foreground/80">Note</span> · {noteTitle}
					</p>
				</div>
				{dueLabel ? (
					<span
						title={dueTitle ?? undefined}
						className={cn(
							"shrink-0 self-start rounded-md border px-2 py-1 text-xs font-semibold sm:self-auto",
							overdue
								? "border-amber-400/45 bg-amber-500/15 text-amber-950 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-50"
								: dueSoon
									? "border-red-400/50 bg-red-500/15 text-red-950 dark:border-red-700/50 dark:bg-red-950/35 dark:text-red-50"
									: "border-border bg-muted/70 text-foreground",
						)}
					>
						Due {dueLabel}
					</span>
				) : (
					<span className="shrink-0 text-xs text-muted-foreground">No due date</span>
				)}
			</Link>
		</li>
	)
}
