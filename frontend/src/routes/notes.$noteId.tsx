import {
	type ChunkOut,
	type NoteOut,
	createChunk,
	deleteChunk,
	getNote,
	updateChunk,
	updateNote,
} from "@/api/notes"
import { ApiError } from "@/client"
import { MarkdownEditor } from "@/components/editor/MarkdownEditor"
import { MarkdownPreview } from "@/components/editor/MarkdownPreview"
import { HomeLayout } from "@/components/layouts/HomeLayout"
import { Button } from "@/components/ui/button"
import { ensureLoggedIn } from "@/hooks/useAuth"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect, useState } from "react"

export const Route = createFileRoute("/notes/$noteId")({
	component: NoteDetailPage,
})

function formatUpdated(iso: string) {
	return new Date(iso).toLocaleString(undefined, {
		dateStyle: "long",
		timeStyle: "short",
	})
}

function NoteDetailPage() {
	const { noteId } = Route.useParams()
	const [mounted, setMounted] = useState(false)
	const [authChecked, setAuthChecked] = useState(false)
	const [loggedIn, setLoggedIn] = useState(false)
	const [note, setNote] = useState<NoteOut | null>(null)
	const [title, setTitle] = useState("")
	const [editingTitle, setEditingTitle] = useState(false)
	const [editingChunkId, setEditingChunkId] = useState<string | null>(null)
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
			const n = await getNote(noteId)
			setNote(n)
			setTitle(n.title ?? "")
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

	const cancelTitleEdit = () => {
		if (note) setTitle(note.title ?? "")
		setEditingTitle(false)
	}

	const saveTitle = async () => {
		if (!note) return
		try {
			const n = await updateNote(note.id, { title: title || null })
			setNote(n)
			setEditingTitle(false)
		} catch (e) {
			setError(e instanceof Error ? e.message : "Save failed")
		}
	}

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

	if (!mounted || !authChecked || !loggedIn) return null

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
			<div className="mx-auto flex w-full max-w-[42rem] flex-col gap-8 px-6 pt-6 pb-16">
				<nav className="text-sm">
					<Link
						to="/notes"
						className="text-muted-foreground transition-colors hover:text-foreground"
					>
						← All notes
					</Link>
				</nav>

				{loading && !note ? (
					<div className="space-y-6 animate-pulse">
						<div className="h-10 w-2/3 rounded-lg bg-muted" />
						<div className="h-4 w-40 rounded bg-muted" />
						<div className="mt-10 space-y-3">
							<div className="h-4 w-full rounded bg-muted" />
							<div className="h-4 w-full rounded bg-muted" />
							<div className="h-4 w-4/5 rounded bg-muted" />
						</div>
					</div>
				) : note ? (
					<>
						<header className="border-b border-border pb-8">
							{editingTitle ? (
								<div className="space-y-4">
									<label
										htmlFor="note-title-edit"
										className="text-sm font-medium text-muted-foreground"
									>
										Title
									</label>
									<input
										id="note-title-edit"
										value={title}
										onChange={(e) => setTitle(e.target.value)}
										className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-lg"
										autoFocus
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
								<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
									<div className="min-w-0 flex-1 space-y-3">
										<h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground md:text-4xl">
											{displayTitle}
										</h1>
										<p className="text-sm text-muted-foreground">
											Updated {formatUpdated(note.updated_ts)}
											{sortedChunks.length > 1
												? ` · ${sortedChunks.length} sections`
												: null}
										</p>
									</div>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="shrink-0 self-start"
										onClick={() => {
											setEditingChunkId(null)
											setEditingTitle(true)
										}}
									>
										Edit title
									</Button>
								</div>
							)}
						</header>

						<div className="flex flex-wrap items-center justify-end gap-2">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="text-muted-foreground"
								onClick={() => void addChunk()}
							>
								Add section
							</Button>
						</div>

						{sortedChunks.length === 0 ? (
							<div className="rounded-xl border border-dashed border-border bg-muted/10 px-6 py-14 text-center">
								<p className="text-muted-foreground">
									No sections yet. Add one to write in markdown.
								</p>
								<Button
									type="button"
									variant="secondary"
									size="sm"
									className="mt-4"
									onClick={() => void addChunk()}
								>
									Add section
								</Button>
							</div>
						) : (
							<div className="flex flex-col gap-12">
								{sortedChunks.map((c, index) => (
									<ChunkBlock
										key={c.id}
										chunk={c}
										index={index}
										total={sortedChunks.length}
										isEditing={editingChunkId === c.id}
										onStartEdit={() => {
											setEditingTitle(false)
											setEditingChunkId(c.id)
										}}
										onCancelEdit={() => setEditingChunkId(null)}
										onSave={(md) => void saveChunk(c, md)}
										onDelete={() => void removeChunk(c)}
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

function ChunkBlock({
	chunk,
	index,
	total,
	isEditing,
	onStartEdit,
	onCancelEdit,
	onSave,
	onDelete,
}: {
	chunk: ChunkOut
	index: number
	total: number
	isEditing: boolean
	onStartEdit: () => void
	onCancelEdit: () => void
	onSave: (md: string) => void
	onDelete: () => void
}) {
	const [draft, setDraft] = useState(chunk.body_md)
	useEffect(() => {
		setDraft(chunk.body_md)
	}, [chunk.id, chunk.body_md, chunk.updated_ts])

	const isEmpty = !chunk.body_md.trim()

	if (isEditing) {
		return (
			<article
				className="scroll-mt-24 rounded-xl border border-border bg-card p-4 shadow-sm"
				aria-label={`Edit section ${index + 1}`}
			>
				<div className="mb-3">
					<span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						Editing section {index + 1}
						{total > 1 ? ` of ${total}` : ""}
					</span>
				</div>
				<MarkdownEditor
					variant="chunk"
					value={draft}
					onChange={setDraft}
					className="w-full"
				/>
				<div className="mt-4 flex flex-wrap gap-2">
					<Button type="button" size="sm" onClick={() => onSave(draft)}>
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
		<article className="relative scroll-mt-24" aria-label={`Section ${index + 1}`}>
			<div
				className={
					total > 1
						? "mb-4 flex items-center justify-between gap-3"
						: "mb-4 flex justify-end"
				}
			>
				{total > 1 ? (
					<span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						Section {index + 1}
					</span>
				) : null}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="shrink-0 text-muted-foreground hover:text-foreground"
					onClick={onStartEdit}
				>
					Edit section
				</Button>
			</div>
			{isEmpty ? (
				<p className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
					This section is empty.
				</p>
			) : (
				<MarkdownPreview source={chunk.body_md} framed={false} />
			)}
		</article>
	)
}
