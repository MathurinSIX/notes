import type { RunsOut } from "@/client/models"
import { RunService } from "@/client/services"
import { isPwaStandalone } from "@/lib/pwa"
import type { QueryKey, UseQueryOptions } from "@tanstack/react-query"

export const ONGOING_WORKFLOW_RUNS_QUERY_KEY = [
	"workflowRuns",
	"ongoing",
] as const

export function ongoingWorkflowRunsQueryOptions(): Omit<
	UseQueryOptions<RunsOut, Error, RunsOut, QueryKey>,
	"queryKey"
> {
	return {
		queryFn: () =>
			RunService.listRuns({
				status: ["pending", "started"],
				deleted: [false],
				limit: 1,
				skip: 0,
			}),
		staleTime: 0,
		refetchInterval: (query) => {
			const pwa = isPwaStandalone()
			const has = query.state.data && query.state.data.count > 0
			if (pwa) return has ? 2500 : 8000
			return has ? 5000 : 20000
		},
	}
}
