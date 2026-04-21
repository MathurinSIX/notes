import { OpenAPI } from "@/client"
import { request } from "@/client/core/request"

export type ChunkOut = {
	id: string
	note_id: string
	body_md: string
	sort_order: number
	due_at: string | null
	completed: boolean
	updated_ts: string
	created_ts: string
	/** Most recent merge workflow update linked to this section, if any. */
	external_note_update_id?: string | null
}

export type NoteTaskOut = {
	id: string
	note_id: string
	title: string
	done: boolean
	due_at?: string | null
	sort_order: number
	updated_ts: string
	created_ts: string
	/** Incoming merge that introduced this follow-up, when known. */
	external_note_update_id?: string | null
	/** When the linked incoming update was submitted (from API when available). */
	source_update_created_ts?: string | null
	/** First line of the linked incoming update body (from API when available). */
	source_update_preview?: string | null
}

export type NoteOut = {
	id: string
	title: string | null
	summary: string | null
	archived: boolean
	full_markdown: string
	chunks: ChunkOut[]
	/** Follow-up tasks from merge workflow; absent on older API responses. */
	tasks?: NoteTaskOut[]
	updated_ts: string
	created_ts: string
}

export type NotesListItem = {
	id: string
	title: string | null
	summary: string | null
	archived: boolean
	updated_ts: string
	created_ts: string
	/** Open follow-up tasks on this note (from API when available). */
	pending_task_count?: number
}

export type NotesNextAction = {
	note_id: string
	note_title: string | null
	task_id: string
	task_title: string
	due_at: string | null
	/** Incoming merge that introduced this follow-up, when known. */
	external_note_update_id?: string | null
	source_update_created_ts?: string | null
	source_update_preview?: string | null
	/** When set, task was completed at this time (recent_done_actions only). */
	done_updated_ts?: string | null
}

export type NotesListResponse = {
	data: NotesListItem[]
	count: number
	next_actions?: NotesNextAction[]
	recent_done_actions?: NotesNextAction[]
}

export type NoteHistoryEvent = {
	kind: "note"
	id: string
	changed_ts: string
	title: string | null
	summary: string | null
	archived: boolean
	external_note_update_id?: string | null
}

export type ChunkHistoryEvent = {
	kind: "chunk"
	id: string
	chunk_id: string
	changed_ts: string
	body_md: string
	sort_order: number
	due_at: string | null
	completed: boolean
	deleted: boolean
	external_note_update_id?: string | null
}

export type TaskHistoryEvent = {
	kind: "task"
	id: string
	task_id: string
	changed_ts: string
	title: string
	done: boolean
	due_at: string | null
	sort_order: number
	deleted: boolean
	external_note_update_id?: string | null
}

export type NoteTimelineOut = {
	events: (NoteHistoryEvent | ChunkHistoryEvent | TaskHistoryEvent)[]
	total: number
	skip: number
	limit: number
}

export type ChunkTimelineOut = {
	events: ChunkHistoryEvent[]
	total: number
	skip: number
	limit: number
}

export type ExternalNoteUpdateOut = {
	id: string
	body_md: string
	status: string
	matched_note_id: string | null
	error_message: string | null
	created_ts: string
	updated_ts: string
	/** Present when status is merged (completion time). */
	merged_ts?: string | null
	matched_note_title?: string | null
}

export type ExternalNoteUpdatesResponse = {
	data: ExternalNoteUpdateOut[]
}

export type ExternalNoteUpdatesPageResponse = {
	data: ExternalNoteUpdateOut[]
	count: number
}

/** Invalidate after submitting a new "Update notes" merge. */
export const MY_EXTERNAL_NOTE_UPDATES_QUERY_KEY = [
	"myExternalNoteUpdates",
] as const

export async function listNotes(params?: {
	skip?: number
	limit?: number
	/** When true, list archived notes only. Default is active notes. */
	archived?: boolean
}): Promise<NotesListResponse> {
	const { skip = 0, limit = 100, archived = false } = params ?? {}
	return request<NotesListResponse>(OpenAPI, {
		method: "GET",
		url: "/notes/",
		query: { skip, limit, archived } as Record<
			string,
			string | number | boolean
		>,
		errors: { 422: "Validation Error" },
	}) as Promise<NotesListResponse>
}

export async function getNote(id: string): Promise<NoteOut> {
	return request<NoteOut>(OpenAPI, {
		method: "GET",
		url: `/notes/${id}`,
		errors: { 422: "Validation Error" },
	}) as Promise<NoteOut>
}

export async function getNoteHistory(
	noteId: string,
	params?: { skip?: number; limit?: number },
): Promise<NoteTimelineOut> {
	const skip = params?.skip ?? 0
	const limit = params?.limit ?? 50
	return request<NoteTimelineOut>(OpenAPI, {
		method: "GET",
		url: `/notes/${noteId}/history`,
		query: { skip, limit } as Record<string, number>,
		errors: { 422: "Validation Error" },
	}) as Promise<NoteTimelineOut>
}

export async function getNoteIncomingUpdates(
	noteId: string,
	params?: { chunkId?: string },
): Promise<ExternalNoteUpdatesResponse> {
	const chunkId = params?.chunkId
	return request<ExternalNoteUpdatesResponse>(OpenAPI, {
		method: "GET",
		url: `/notes/${noteId}/incoming-updates`,
		query:
			chunkId != null && chunkId.length > 0
				? ({ chunk_id: chunkId } as Record<string, string>)
				: undefined,
		errors: { 422: "Validation Error" },
	}) as Promise<ExternalNoteUpdatesResponse>
}

/** One incoming update linked to this note (e.g. follow-up task source). */
export async function getNoteIncomingUpdate(
	noteId: string,
	updateId: string,
): Promise<ExternalNoteUpdateOut> {
	return request<ExternalNoteUpdateOut>(OpenAPI, {
		method: "GET",
		url: `/notes/${noteId}/incoming-updates/${updateId}`,
		errors: { 422: "Validation Error" },
	}) as Promise<ExternalNoteUpdateOut>
}

export async function listMyExternalNoteUpdates(params?: {
	skip?: number
	limit?: number
}): Promise<ExternalNoteUpdatesPageResponse> {
	const skip = params?.skip ?? 0
	const limit = params?.limit ?? 100
	return request<ExternalNoteUpdatesPageResponse>(OpenAPI, {
		method: "GET",
		url: "/notes/sent-updates",
		query: { skip, limit } as Record<string, number>,
		errors: { 422: "Validation Error" },
	}) as Promise<ExternalNoteUpdatesPageResponse>
}

export async function getChunkHistory(
	noteId: string,
	chunkId: string,
	params?: { skip?: number; limit?: number },
): Promise<ChunkTimelineOut> {
	const skip = params?.skip ?? 0
	const limit = params?.limit ?? 50
	return request<ChunkTimelineOut>(OpenAPI, {
		method: "GET",
		url: `/notes/${noteId}/chunks/${chunkId}/history`,
		query: { skip, limit } as Record<string, number>,
		errors: { 422: "Validation Error" },
	}) as Promise<ChunkTimelineOut>
}

export async function updateNote(
	id: string,
	body: {
		title?: string | null
		summary?: string | null
		archived?: boolean
	},
): Promise<NoteOut> {
	return request<NoteOut>(OpenAPI, {
		method: "PATCH",
		url: `/notes/${id}`,
		body,
		mediaType: "application/json",
		errors: { 422: "Validation Error" },
	}) as Promise<NoteOut>
}

export async function patchNoteTask(
	noteId: string,
	taskId: string,
	body: {
		done?: boolean | null
		title?: string | null
		due_at?: string | null
	},
): Promise<NoteOut> {
	return request<NoteOut>(OpenAPI, {
		method: "PATCH",
		url: `/notes/${noteId}/tasks/${taskId}`,
		body,
		mediaType: "application/json",
		errors: { 422: "Validation Error" },
	}) as Promise<NoteOut>
}

export async function createNote(body?: {
	title?: string | null
	summary?: string | null
}): Promise<NoteOut> {
	return request<NoteOut>(OpenAPI, {
		method: "POST",
		url: "/notes/",
		body: body ?? {},
		mediaType: "application/json",
		errors: { 422: "Validation Error" },
	}) as Promise<NoteOut>
}

export async function createChunk(
	noteId: string,
	body: {
		body_md: string
		sort_order?: number | null
		due_at?: string | null
		completed?: boolean | null
	},
): Promise<ChunkOut> {
	return request<ChunkOut>(OpenAPI, {
		method: "POST",
		url: `/notes/${noteId}/chunks`,
		body,
		mediaType: "application/json",
		errors: { 422: "Validation Error" },
	}) as Promise<ChunkOut>
}

export async function updateChunk(
	chunkId: string,
	body: {
		body_md?: string | null
		sort_order?: number | null
		due_at?: string | null
		completed?: boolean | null
	},
): Promise<ChunkOut> {
	return request<ChunkOut>(OpenAPI, {
		method: "PATCH",
		url: `/chunks/${chunkId}`,
		body,
		mediaType: "application/json",
		errors: { 422: "Validation Error" },
	}) as Promise<ChunkOut>
}

export async function deleteChunk(chunkId: string): Promise<void> {
	await request(OpenAPI, {
		method: "DELETE",
		url: `/chunks/${chunkId}`,
		errors: { 422: "Validation Error" },
	})
}

export async function deleteNote(noteId: string): Promise<void> {
	await request(OpenAPI, {
		method: "DELETE",
		url: `/notes/${noteId}`,
		errors: { 422: "Validation Error" },
	})
}
