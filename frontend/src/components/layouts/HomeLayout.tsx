import { listNotes, MY_EXTERNAL_NOTE_UPDATES_QUERY_KEY } from "@/api/notes"
import { startUpdateNotesWorkflow } from "@/api/workflow"
import { ApiError } from "@/client"
import Breadcrumb from "@/components/Breadcrumb"
import { NextActionsHeaderLink } from "@/components/NextActionsHeaderLink"
import { ProjectLogo } from "@/components/ProjectLogo"
import SettingMenu from "@/components/SettingMenu"
import { OpenUpdateNotesModalContext } from "@/components/UpdateNotesModalContext"
import { WorkflowTopBarIndicator } from "@/components/WorkflowTopBarIndicator"
import { Button } from "@/components/ui/button"
import { useColorModeValue } from "@/components/ui/color-mode"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { readStoredUpdateNotesFallbackNoteId } from "@/lib/updateNotesFallback"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useRouterState } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"

const NOTE_DETAIL_UUID_RE =
	/^\/notes\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

function fallbackNoteIdFromPathname(pathname: string): string | undefined {
	const m = pathname.match(NOTE_DETAIL_UUID_RE)
	return m?.[1]
}

interface HomeLayoutProps {
	children: React.ReactNode
}

export function HomeLayout({ children }: HomeLayoutProps) {
	const borderColor = useColorModeValue("border-gray-200", "border-gray-800")
	const queryClient = useQueryClient()
	const pathname = useRouterState({ select: (s) => s.location.pathname })
	const noteIdFromPath = useMemo(
		() => fallbackNoteIdFromPathname(pathname),
		[pathname],
	)
	const updateNotesAutoFallbackNoteId = useMemo(() => {
		return (
			noteIdFromPath ?? readStoredUpdateNotesFallbackNoteId() ?? undefined
		)
	}, [noteIdFromPath, pathname])
	const [updateNotesOpen, setUpdateNotesOpen] = useState(false)
	const [updateNotesTargetNoteId, setUpdateNotesTargetNoteId] = useState<
		string | null
	>(null)
	const [updateNotesText, setUpdateNotesText] = useState("")
	const [updateNotesSubmitting, setUpdateNotesSubmitting] = useState(false)
	const [updateNotesError, setUpdateNotesError] = useState<string | null>(
		null,
	)

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

	const submitUpdateNotes = async () => {
		const body_md = updateNotesText.trim()
		if (!body_md) {
			setUpdateNotesError("Please enter some text.")
			return
		}
		setUpdateNotesSubmitting(true)
		setUpdateNotesError(null)
		try {
			const fallback_note_id =
				(updateNotesTargetNoteId && updateNotesTargetNoteId.length > 0
					? updateNotesTargetNoteId
					: updateNotesAutoFallbackNoteId) ?? undefined
			await startUpdateNotesWorkflow({
				body_md,
				...(fallback_note_id ? { fallback_note_id } : {}),
			})
			void queryClient.invalidateQueries({
				queryKey: ["workflowRuns", "ongoing"],
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
			<div className="relative mb-2 flex min-h-screen flex-col bg-gradient-to-br from-background via-primary/[0.04] to-chart-4/[0.12] dark:via-background dark:to-chart-2/20">
				<div
					className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,hsl(var(--primary)_/_0.18),transparent_65%)] dark:bg-[radial-gradient(ellipse_80%_55%_at_50%_-5%,hsl(var(--chart-4)_/_0.22),transparent_70%)]"
					aria-hidden
				/>
				<header
					className={`sticky top-0 z-50 flex h-16 items-center border-b ${borderColor} bg-background/75 px-6 backdrop-blur-md backdrop-saturate-150 dark:bg-background/65`}
				>
					<Link
						to="/"
						className="flex shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
					>
						<ProjectLogo />
					</Link>
					<WorkflowTopBarIndicator />
					<div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-3 md:gap-4">
						<Button
							type="button"
							variant="updateNotes"
							size="sm"
							onClick={openUpdateNotesModal}
						>
							Update notes
						</Button>
						<NextActionsHeaderLink />
						<Link
							to="/notes"
							className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
						>
							Notes
						</Link>
						<Link
							to="/notes/updates"
							className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
						>
							Updates
						</Link>
						<SettingMenu />
					</div>
				</header>
				<Breadcrumb />
				<main className="relative z-0 mx-auto w-full max-w-7xl overflow-x-clip">
					{children}
				</main>

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
					<DialogContent className="max-w-4xl">
						<DialogHeader>
							<DialogTitle>Update notes</DialogTitle>
							<DialogDescription asChild>
								<div className="space-y-2 text-sm text-muted-foreground">
									<p>
										Paste text to merge into your
										best-matching note. A workflow picks the
										note using summaries, then updates
										sections with AI.
									</p>
									{updateNotesAutoFallbackNoteId ? (
										<p>
											If matching is unclear, the merge
											falls back to the note in your URL
											or the last note you had open
											(including when you open Updates
											from a note).
										</p>
									) : (
										<p>
											If matching is unclear, you can
											optionally pick a fallback note
											below.
										</p>
									)}
								</div>
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-3 py-1">
							<div className="space-y-1.5">
								<label
									htmlFor="update-notes-target"
									className="text-sm font-medium text-muted-foreground"
								>
									Target note when matching is unclear
									<span className="font-normal text-muted-foreground">
										{" "}
										(optional)
									</span>
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
									className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
								>
									<option value="">
										Automatic (URL or last-viewed note)
									</option>
									{updateNotesPickerRows.map((n) => (
										<option key={n.id} value={n.id}>
											{(n.title ?? "").trim() ||
												"Untitled"}
										</option>
									))}
								</select>
							</div>
							<label
								htmlFor="update-notes-body"
								className="text-sm font-medium text-muted-foreground"
							>
								Update text
							</label>
							<textarea
								id="update-notes-body"
								value={updateNotesText}
								onChange={(e) =>
									setUpdateNotesText(e.target.value)
								}
								rows={14}
								placeholder="Write what you want reflected in your notes…"
								disabled={updateNotesSubmitting}
								className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-sm leading-relaxed"
							/>
							{updateNotesError ? (
								<p
									role="alert"
									className="text-sm text-red-600 dark:text-red-400"
								>
									{updateNotesError}
								</p>
							) : null}
						</div>
						<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
							<Button
								type="button"
								variant="outline"
								disabled={updateNotesSubmitting}
								onClick={() => setUpdateNotesOpen(false)}
							>
								Cancel
							</Button>
							<Button
								type="button"
								disabled={updateNotesSubmitting}
								onClick={() => void submitUpdateNotes()}
							>
								{updateNotesSubmitting
									? "Starting…"
									: "Run update"}
							</Button>
						</div>
					</DialogContent>
				</Dialog>
			</div>
		</OpenUpdateNotesModalContext.Provider>
	)
}
