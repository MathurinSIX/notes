import { RunService } from "@/client/services"
import { useQuery } from "@tanstack/react-query"

export function WorkflowTopBarIndicator() {
	const { data } = useQuery({
		queryKey: ["workflowRuns", "ongoing"],
		queryFn: () =>
			RunService.listRuns({
				status: ["pending", "started"],
				deleted: [false],
				limit: 1,
				skip: 0,
			}),
		refetchInterval: (query) =>
			query.state.data && query.state.data.count > 0 ? 5000 : 20000,
	})

	const n = data?.count ?? 0
	if (n === 0) return null

	return (
		<div
			className="ml-4 flex min-w-0 flex-1 items-center justify-center gap-2 px-2"
			role="status"
			aria-live="polite"
			aria-label={
				n === 1
					? "One workflow is in progress"
					: `${n} workflows are in progress`
			}
		>
			<span
				className="h-2 w-2 shrink-0 rounded-full bg-amber-500 animate-pulse"
				aria-hidden
			/>
			<span className="truncate text-sm text-muted-foreground">
				{n === 1
					? "Workflow in progress"
					: `${n} workflows in progress`}
			</span>
		</div>
	)
}
