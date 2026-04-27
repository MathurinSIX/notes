import {
	ONGOING_WORKFLOW_RUNS_QUERY_KEY,
	ongoingWorkflowRunsQueryOptions,
} from "@/lib/ongoingWorkflowRunsQuery"
import { isPwaStandalone } from "@/lib/pwa"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

export function WorkflowTopBarIndicator() {
	const queryClient = useQueryClient()
	const { data } = useQuery({
		queryKey: ONGOING_WORKFLOW_RUNS_QUERY_KEY,
		...ongoingWorkflowRunsQueryOptions(),
	})

	useEffect(() => {
		if (!isPwaStandalone()) return
		const onVisibility = () => {
			if (document.visibilityState !== "visible") return
			void queryClient.invalidateQueries({
				queryKey: ONGOING_WORKFLOW_RUNS_QUERY_KEY,
			})
		}
		document.addEventListener("visibilitychange", onVisibility)
		return () =>
			document.removeEventListener("visibilitychange", onVisibility)
	}, [queryClient])

	const n = data?.count ?? 0
	if (n === 0) return null

	return (
		<div
			className="ml-1 flex min-w-0 flex-1 items-center justify-center gap-1.5 px-1 sm:ml-2 sm:px-2"
			role="status"
			aria-live="polite"
			aria-label={
				n === 1
					? "One workflow is in progress"
					: `${n} workflows are in progress`
			}
		>
			<span
				className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500 animate-pulse"
				aria-hidden
			/>
			<span className="truncate text-xs text-muted-foreground">
				{n === 1 ? "Running…" : `${n} running`}
			</span>
		</div>
	)
}
