import { type NotesListItem, createNote, listNotes } from "@/api/notes"
import { ApiError } from "@/client"
import { HomeLayout } from "@/components/layouts/HomeLayout"
import { Button } from "@/components/ui/button"
import { ensureLoggedIn } from "@/hooks/useAuth"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect, useState } from "react"

export const Route = createFileRoute("/notes/")({
	component: NotesPage,
})

function NotesPage() {
	const [mounted, setMounted] = useState(false)
	const [authChecked, setAuthChecked] = useState(false)
	const [loggedIn, setLoggedIn] = useState(false)
	const [notes, setNotes] = useState<NotesListItem[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const navigate = useNavigate()

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
			const res = await listNotes()
			setNotes(res.data)
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
	}, [])

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
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pt-8 pb-14">
				<div className="flex flex-wrap items-end justify-between gap-4">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight text-foreground">
							Notes
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							{loading
								? "Loading…"
								: notes.length === 0
									? "Start your first note"
									: `${notes.length} ${notes.length === 1 ? "note" : "notes"}`}
						</p>
					</div>
					<Button type="button" onClick={() => void handleNewNote()}>
						New note
					</Button>
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
					<ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
						{Array.from({ length: 6 }).map((_, i) => (
							<li
								key={i}
								className="h-36 animate-pulse rounded-xl border border-border bg-muted/40"
							/>
						))}
					</ul>
				) : notes.length === 0 ? (
					<div className="rounded-xl border border-dashed border-border bg-muted/20 px-8 py-16 text-center">
						<p className="text-muted-foreground">
							No notes yet. Create one to get started.
						</p>
					</div>
				) : (
					<ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
						{notes.map((n) => {
							const title = n.title?.trim() || "Untitled"
							return (
								<li key={n.id}>
									<Link
										to="/notes/$noteId"
										params={{ noteId: n.id }}
										className="group flex h-full min-h-[8.5rem] flex-col rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm outline-none ring-offset-background transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									>
										<div className="flex flex-1 flex-col gap-3">
											<h2 className="line-clamp-2 text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
												{title}
											</h2>
											<div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3">
												<time
													className="text-xs text-muted-foreground"
													dateTime={n.updated_ts}
												>
													{formatUpdated(n.updated_ts)}
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
