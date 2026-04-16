import { OpenAPI } from "@/client"
import { request } from "@/client/core/request"

export type WorkflowStatus =
	| "pending"
	| "skipped"
	| "started"
	| "failed"
	| "succeeded"
	| "stopped"

export type Run = {
	id: string
	name: string
	workflow: string
	status: WorkflowStatus
	created_by: { id: string; email: string }
	documents: unknown[]
	params: Record<string, unknown> | null
	output: Record<string, unknown> | null
	updated_ts: string
	created_ts: string
}

export type RunsResponse = {
	data: Run[]
	count: number
}

export async function runSummarizeWorkflow(text: string): Promise<void> {
	await request(OpenAPI, {
		method: "POST",
		url: "/workflow/example-workflow",
		body: { text },
		mediaType: "application/json",
		errors: { 422: "Validation Error" },
	})
}

export async function listSummarizeRuns(params?: {
	skip?: number
	limit?: number
}): Promise<RunsResponse> {
	const { skip = 0, limit = 50 } = params ?? {}
	const query: Record<string, unknown> = {
		workflow: ["example-workflow"],
		skip,
		limit,
	}
	const result = await request<RunsResponse>(OpenAPI, {
		method: "GET",
		url: "/run/",
		query: query as Record<string, string | number | string[]>,
		errors: { 422: "Validation Error" },
	})
	return result as RunsResponse
}
