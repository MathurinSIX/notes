import {
	type Run,
	listSummarizeRuns,
	runSummarizeWorkflow,
} from "@/api/summarize"
import { ApiError } from "@/client"
import type { UserOut } from "@/client/models"
import { UserService } from "@/client/services"
import { HomeLayout } from "@/components/layouts/HomeLayout"
import { Button } from "@/components/ui/button"
import { ensureLoggedIn } from "@/hooks/useAuth"
import { useId } from "react"
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"

const POLL_INTERVAL_MS = 2000
const ONGOING_STATUSES = ["started", "pending"]

export function HomePage() {
	const [mounted, setMounted] = useState(false)
	const [authChecked, setAuthChecked] = useState(false)
	const [loggedIn, setLoggedIn] = useState(false)
	const [user, setUser] = useState<UserOut | null>(null)
	const [text, setText] = useState("")
	const [runs, setRuns] = useState<Run[]>([])
	const [loading, setLoading] = useState(false)
	const [submitting, setSubmitting] = useState(false)
	const [justSubmitted, setJustSubmitted] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const navigate = useNavigate()
	const textareaId = useId()

	useEffect(() => {
		setMounted(true)
	}, [])

	useEffect(() => {
		if (!mounted) return
		ensureLoggedIn().then((ok) => {
			setAuthChecked(true)
			if (!ok) {
				navigate({ to: "/login" })
			} else {
				setLoggedIn(true)
			}
		})
	}, [mounted, navigate])

	useEffect(() => {
		if (mounted && loggedIn) {
			UserService.self()
				.then(setUser)
				.catch(() => setUser(null))
		}
	}, [mounted, loggedIn])

	const fetchRuns = useCallback(async () => {
		try {
			setLoading(true)
			setError(null)
			const res = await listSummarizeRuns()
			setRuns(res.data)
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load runs")
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		if (mounted && loggedIn) {
			fetchRuns()
		}
	}, [mounted, loggedIn, fetchRuns])

	useEffect(() => {
		if (!mounted || !loggedIn) return
		const hasOngoing = runs.some((r) => ONGOING_STATUSES.includes(r.status))
		if (!hasOngoing) return
		const id = setInterval(fetchRuns, POLL_INTERVAL_MS)
		return () => clearInterval(id)
	}, [mounted, loggedIn, runs, fetchRuns])

	useEffect(() => {
		if (!justSubmitted) return
		const id = setInterval(fetchRuns, 1000)
		return () => clearInterval(id)
	}, [justSubmitted, fetchRuns])

	useEffect(() => {
		if (!justSubmitted) return
		const id = setTimeout(() => setJustSubmitted(false), 10000)
		return () => clearTimeout(id)
	}, [justSubmitted])

	const handleSummarize = async () => {
		if (!text.trim()) return
		try {
			setSubmitting(true)
			setError(null)
			await runSummarizeWorkflow(text.trim())
			setJustSubmitted(true)
			await fetchRuns()
		} catch (e: unknown) {
			let msg = "Failed to start summarize"
			if (
				e instanceof ApiError &&
				e.body &&
				typeof e.body === "object" &&
				"detail" in e.body
			) {
				msg = String((e.body as { detail: unknown }).detail)
			} else if (e instanceof Error) {
				msg = e.message
			}
			setError(msg)
		} finally {
			setSubmitting(false)
		}
	}

	const statusBadgeClass = (status: string) => {
		switch (status) {
			case "succeeded":
				return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
			case "failed":
			case "stopped":
				return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
			case "started":
			case "pending":
				return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
			default:
				return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
		}
	}

	if (!mounted || !authChecked || !loggedIn) {
		return null
	}

	const displayName = user?.full_name?.trim() || "there"

	return (
		<HomeLayout>
			<div className="flex flex-col pt-8 gap-6">
				<div className="w-full px-6">
					<h1 className="text-2xl font-semibold text-foreground">
						Welcome
						{displayName !== "there" ? `, ${displayName}` : ""}
					</h1>
					<p className="mt-2 text-muted-foreground">
						Enter text below and click Summarize to run the example
						workflow. View current and previous runs in the table.
					</p>
				</div>

				<div className="w-full px-6 space-y-4">
					<div>
						<label
							htmlFor={textareaId}
							className="block text-sm font-medium text-foreground mb-2"
						>
							Text to summarize
						</label>
						<textarea
							id={textareaId}
							placeholder="Enter long text to summarize..."
							value={text}
							onChange={(e) => setText(e.target.value)}
							className="w-full min-h-[120px] px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
							rows={6}
						/>
						<Button
							onClick={handleSummarize}
							disabled={!text.trim() || submitting}
							className="mt-3"
						>
							{submitting ? (
								<span className="flex items-center gap-2">
									<span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
									Summarizing...
								</span>
							) : (
								"Summarize"
							)}
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

					<div>
						<h2 className="text-lg font-semibold text-foreground mb-3">
							Runs
						</h2>
						{loading && runs.length === 0 ? (
							<div className="flex items-center gap-2 text-muted-foreground">
								<span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
								Loading runs...
							</div>
						) : runs.length === 0 ? (
							<p className="text-muted-foreground">
								No runs yet. Click Summarize to start one.
							</p>
						) : (
							<div className="overflow-x-auto rounded-md border border-border">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b border-border bg-muted/50">
											<th className="px-4 py-3 text-left font-medium text-foreground">
												Name
											</th>
											<th className="px-4 py-3 text-left font-medium text-foreground">
												Status
											</th>
											<th className="px-4 py-3 text-left font-medium text-foreground">
												Created
											</th>
											<th className="px-4 py-3 text-left font-medium text-foreground">
												Input
											</th>
											<th className="px-4 py-3 text-left font-medium text-foreground">
												Summary
											</th>
										</tr>
									</thead>
									<tbody>
										{runs.map((run) => {
											const summaryVal =
												run.output?.summary
											const summaryText =
												typeof summaryVal === "string"
													? summaryVal
													: (
															summaryVal as {
																summary?: string
															}
													  )?.summary
											return (
												<tr
													key={run.id}
													className="border-b border-border last:border-b-0 hover:bg-muted/30"
												>
													<td className="px-4 py-3 text-foreground">
														{run.name || run.id}
													</td>
													<td className="px-4 py-3">
														<span
															className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(
																run.status,
															)}`}
														>
															{ONGOING_STATUSES.includes(
																run.status,
															) && (
																<span className="inline-block size-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
															)}
															{run.status}
														</span>
													</td>
													<td className="px-4 py-3 text-muted-foreground">
														{new Date(
															run.created_ts,
														).toLocaleString()}
													</td>
													<td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
														{run.params?.text
															? String(
																	run.params
																		.text,
															  )
															: "—"}
													</td>
													<td className="px-4 py-3 text-foreground max-w-[300px]">
														{summaryText || "—"}
													</td>
												</tr>
											)
										})}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</div>
			</div>
		</HomeLayout>
	)
}
