import { MY_EXTERNAL_NOTE_UPDATES_QUERY_KEY, listNotes } from "@/api/notes"
import { startUpdateNotesWorkflow } from "@/api/workflow"
import { ApiError } from "@/client"
import { NextActionsHeaderLink } from "@/components/NextActionsHeaderLink"
import { ProjectLogo } from "@/components/ProjectLogo"
import { OpenUpdateNotesModalContext } from "@/components/UpdateNotesModalContext"
import { WorkflowTopBarIndicator } from "@/components/WorkflowTopBarIndicator"
import { Button } from "@/components/ui/button"
import { ColorModeButton, useColorModeValue } from "@/components/ui/color-mode"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { logout } from "@/hooks/useAuth"
import { ONGOING_WORKFLOW_RUNS_QUERY_KEY } from "@/lib/ongoingWorkflowRunsQuery"
import { isPwaStandalone } from "@/lib/pwa"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useEffect, useMemo, useRef, useState } from "react"
import { MdLogout } from "react-icons/md"

interface HomeLayoutProps {
	children: React.ReactNode
}

export function HomeLayout({ children }: HomeLayoutProps) {
	const borderColor = useColorModeValue("border-gray-200", "border-gray-800")
	const queryClient = useQueryClient()
	const [updateNotesOpen, setUpdateNotesOpen] = useState(false)
	const [updateNotesTargetNoteId, setUpdateNotesTargetNoteId] = useState<
		string | null
	>(null)
	const [updateNotesText, setUpdateNotesText] = useState("")
	const [updateNotesSubmitting, setUpdateNotesSubmitting] = useState(false)
	const [updateNotesError, setUpdateNotesError] = useState<string | null>(
		null,
	)
	const updateNotesBodyRef = useRef<HTMLTextAreaElement | null>(null)

	const { data: updateNotesPickerNotes } = useQuery({
		queryKey: ["notes", "updateNotesModalPicker"],
		queryFn: () => listNotes({ limit: 200, archived: false }),
		enabled: updateNotesOpen,
	})

	useEffect(() => {
		const returnTo = sessionStorage.getItem("return_to")
		if (returnTo) {
			sessionStorage.removeItem("return_to")
			window.location.pathname = returnTo
		}
	}, [])

	useEffect(() => {
		if (!updateNotesOpen) return
		// Focus after dialog content mounts.
		requestAnimationFrame(() => {
			updateNotesBodyRef.current?.focus()
		})
	}, [updateNotesOpen])

	const submitUpdateNotes = async () => {
		const body_md = updateNotesText.trim()
		if (!body_md) {
			setUpdateNotesError("Please enter some text.")
			return
		}
		setUpdateNotesSubmitting(true)
		setUpdateNotesError(null)
		try {
			const picked =
				updateNotesTargetNoteId && updateNotesTargetNoteId.length > 0
					? updateNotesTargetNoteId
					: null
			await startUpdateNotesWorkflow({
				body_md,
				...(picked ? { force_matched_note_id: picked } : {}),
			})
			if (isPwaStandalone()) {
				window.location.reload()
				return
			}
			void queryClient.invalidateQueries({
				queryKey: ONGOING_WORKFLOW_RUNS_QUERY_KEY,
			})
			void queryClient.invalidateQueries({
				queryKey: [...MY_EXTERNAL_NOTE_UPDATES_QUERY_KEY],
			})
			setUpdateNotesOpen(false)
			setUpdateNotesText("")
			setUpdateNotesTargetNoteId(null)
		} catch (e) {
			let msg = "Could not start update"
			if (e instanceof ApiError && e.body && typeof e.body === "object") {
				const d = e.body as { detail?: unknown }
				if (d.detail) msg = String(d.detail)
			} else if (e instanceof Error) msg = e.message
			setUpdateNotesError(msg)
		} finally {
			setUpdateNotesSubmitting(false)
		}
	}

	const openUpdateNotesModal = () => {
		setUpdateNotesError(null)
		setUpdateNotesTargetNoteId(null)
		setUpdateNotesOpen(true)
	}

	const updateNotesPickerRows = useMemo(() => {
		const rows = updateNotesPickerNotes?.data ?? []
		return [...rows].sort((a, b) => {
			const ta = (a.title ?? "").trim() || "Untitled"
			const tb = (b.title ?? "").trim() || "Untitled"
			return ta.localeCompare(tb, undefined, { sensitivity: "base" })
		})
	}, [updateNotesPickerNotes?.data])

	return (
		<OpenUpdateNotesModalContext.Provider value={openUpdateNotesModal}>
			<div className="relative flex min-h-screen flex-col bg-background">
				<div
					className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_70%_50%_at_50%_-20%,hsl(var(--primary)_/_0.1),transparent_70%)] dark:bg-[radial-gradient(ellipse_70%_45%_at_50%_-15%,hsl(var(--chart-4)_/_0.12),transparent_72%)]"
					aria-hidden
				/>
				<header
					className={`sticky top-0 z-50 flex h-10 items-center gap-2 border-b ${borderColor} bg-background/90 px-2 backdrop-blur-sm backdrop-saturate-150 sm:px-3 dark:bg-background/85`}
				>
					<Link
						to="/"
						className="flex shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
					>
						<ProjectLogo className="text-sm" />
					</Link>
					<WorkflowTopBarIndicator />
					<div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-4 sm:gap-5">
						<NextActionsHeaderLink />
						<Link
							to="/notes"
							className="text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
						>
							Notes
						</Link>
						<Link
							to="/notes/updates"
							className="text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
						>
							Updates
						</Link>
						<div className="flex shrink-0 items-center gap-2">
							<ColorModeButton className="h-7 w-7 shrink-0" />
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
								aria-label="Log out"
								onClick={() => logout()}
							>
								<MdLogout className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</header>
				<main className="relative z-0 w-full min-w-0 overflow-x-clip">
					{children}
				</main>

				<Button
					type="button"
					variant="updateNotes"
					onClick={openUpdateNotesModal}
					className="fixed bottom-[max(1rem,env(safe-area-inset-bottom,0px))] right-[max(1rem,env(safe-area-inset-right,0px))] z-40 h-12 min-w-[9.25rem] rounded-xl px-5 text-sm font-semibold shadow-md ring-1 ring-black/10 hover:brightness-110 hover:shadow-lg active:brightness-95 sm:h-[3.25rem] sm:min-w-[10.5rem] sm:px-6 sm:text-base dark:ring-white/10"
				>
					Update notes
				</Button>

				<Dialog
					open={updateNotesOpen}
					onOpenChange={(open) => {
						setUpdateNotesOpen(open)
						if (!open) {
							setUpdateNotesError(null)
							setUpdateNotesTargetNoteId(null)
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
									Update notes
								</DialogTitle>
							</div>
							<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 sm:gap-4 sm:p-6">
								<div className="flex shrink-0 flex-col gap-1.5">
									<label
										htmlFor="update-notes-target"
										className="text-sm font-medium text-foreground"
									>
										Match to note
									</label>
									<select
										id="update-notes-target"
										value={updateNotesTargetNoteId ?? ""}
										onChange={(e) => {
											const v = e.target.value
											setUpdateNotesTargetNoteId(
												v === "" ? null : v,
											)
										}}
										disabled={updateNotesSubmitting}
										className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:text-base"
									>
										<option value="">Automatic</option>
										{updateNotesPickerRows.map((n) => (
											<option key={n.id} value={n.id}>
												{(n.title ?? "").trim() ||
													"Untitled"}
											</option>
										))}
									</select>
								</div>
								<div className="flex min-h-0 flex-1 flex-col gap-1.5">
									<label
										htmlFor="update-notes-body"
										className="text-sm font-medium text-foreground"
									>
										Text to merge
									</label>
									<textarea
										id="update-notes-body"
										ref={updateNotesBodyRef}
										value={updateNotesText}
										onChange={(e) =>
											setUpdateNotesText(e.target.value)
										}
										disabled={updateNotesSubmitting}
										placeholder="Plain text…"
										className="min-h-0 w-full flex-1 resize-y rounded-md border border-input bg-background px-3 py-2.5 text-sm leading-relaxed outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:text-base"
									/>
								</div>
								{updateNotesError ? (
									<p
										role="alert"
										className="shrink-0 text-sm text-red-600 dark:text-red-400"
									>
										{updateNotesError}
									</p>
								) : null}
							</div>
							<div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end sm:gap-3 sm:p-6">
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={updateNotesSubmitting}
									onClick={() => setUpdateNotesOpen(false)}
								>
									Cancel
								</Button>
								<Button
									type="button"
									size="sm"
									disabled={updateNotesSubmitting}
									onClick={() => void submitUpdateNotes()}
								>
									{updateNotesSubmitting
										? "Starting…"
										: "Run update"}
								</Button>
							</div>
						</div>
					</DialogContent>
				</Dialog>
			</div>
		</OpenUpdateNotesModalContext.Provider>
	)
}
