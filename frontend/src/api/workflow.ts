import { OpenAPI } from "@/client"
import { request } from "@/client/core/request"

export type UpdateNotesWorkflowResponse = {
	external_note_update_id: string
}

/** Queues background merge: match note by title and description, merge chunks with OpenAI, link history. */
export async function startUpdateNotesWorkflow(body: {
	body_md: string
	/** When the matcher returns no fit, merge into this note (yours, active). Omit for normal automatic mode so the update can stay awaiting_note until the user picks on Updates. */
	fallback_note_id?: string
	/** When set, skip matching and merge into this note (must be yours, active). */
	force_matched_note_id?: string
}): Promise<UpdateNotesWorkflowResponse> {
	return request<UpdateNotesWorkflowResponse>(OpenAPI, {
		method: "POST",
		url: "/workflow/update-notes",
		body,
		mediaType: "application/json",
		errors: { 422: "Validation Error", 503: "Service unavailable" },
	}) as Promise<UpdateNotesWorkflowResponse>
}

/** Undo merge if status was merged; if awaiting_note, only queues merge into `target_note_id` (matcher skipped). */
export async function reapplySentExternalNoteMerge(
	updateId: string,
	body: { target_note_id: string },
): Promise<UpdateNotesWorkflowResponse> {
	return request<UpdateNotesWorkflowResponse>(OpenAPI, {
		method: "POST",
		url: `/notes/sent-updates/${updateId}/reapply`,
		body,
		mediaType: "application/json",
		errors: {
			400: "Bad Request",
			422: "Validation Error",
			503: "Service unavailable",
		},
	}) as Promise<UpdateNotesWorkflowResponse>
}
