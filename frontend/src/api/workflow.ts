import { OpenAPI } from "@/client"
import { request } from "@/client/core/request"

export type UpdateNotesWorkflowResponse = {
	external_note_update_id: string
}

/** Queues background merge: match note by summary, merge chunks with OpenAI, link history. */
export async function startUpdateNotesWorkflow(body: {
	body_md: string
	/** When the matcher returns no fit, merge into this note if it is yours. */
	fallback_note_id?: string
}): Promise<UpdateNotesWorkflowResponse> {
	return request<UpdateNotesWorkflowResponse>(OpenAPI, {
		method: "POST",
		url: "/workflow/update-notes",
		body,
		mediaType: "application/json",
		errors: { 422: "Validation Error", 503: "Service unavailable" },
	}) as Promise<UpdateNotesWorkflowResponse>
}
