import {
	type ExternalNoteUpdateOut,
	MY_EXTERNAL_NOTE_UPDATES_QUERY_KEY,
	listMyExternalNoteUpdates,
} from "@/api/notes"
import { ApiError } from "@/client"
import { HomeLayout } from "@/components/layouts/HomeLayout"
import { ensureLoggedIn } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"

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
		default:
			return "bg-muted text-foreground"
	}
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
	const [mounted, setMounted] = useState(false)
	const [authChecked, setAuthChecked] = useState(false)
	const [loggedIn, setLoggedIn] = useState(false)
	const [skip, setSkip] = useState(0)
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

	if (!mounted || !authChecked || !loggedIn) return null

	const errMsg = (() => {
		if (!error) return null
		if (
			error instanceof ApiError &&
			error.body &&
			typeof error.body === "object"
		) {
			const d = (error.body as { detail?: unknown }).detail
			if (d != null) return String(d)
		}
		if (error instanceof Error) return error.message
		return String(error)
	})()

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
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 pb-10 pt-5">
				<div className="space-y-2">
					<h1 className="bg-gradient-to-r from-foreground via-amber-700 to-chart-4 bg-clip-text text-2xl font-semibold tracking-tight text-transparent dark:from-foreground dark:via-amber-300 dark:to-chart-4">
						Sent updates
					</h1>
					<p className="text-sm text-muted-foreground">
						{isLoading
							? "Loading…"
							: total === 0
							  ? "No merge requests yet"
							  : `${total} update${
										total === 1 ? "" : "s"
								  } submitted via “Update notes”`}
					</p>
				</div>

				{errMsg ? (
					<div
						role="alert"
						className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
					>
						{errMsg}
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
							in the header to send text for background merge into
							your notes. If you came from a note, that note is
							the default when the matcher is unsure; you can also
							pick a target in the dialog.{" "}
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
							<table className="w-full min-w-[640px] border-collapse text-sm">
								<thead>
									<tr className="border-b border-border bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
										<th className="px-4 py-3">Sent</th>
										<th className="px-4 py-3">Merged</th>
										<th className="px-4 py-3">Status</th>
										<th className="px-4 py-3">Note</th>
										<th className="px-4 py-3">Preview</th>
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
													{u.status}
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
		</HomeLayout>
	)
}
