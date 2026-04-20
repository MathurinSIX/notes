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
}

export type NoteOut = {
	id: string
	title: string | null
	full_markdown: string
	chunks: ChunkOut[]
	updated_ts: string
	created_ts: string
}

export type NotesListItem = {
	id: string
	title: string | null
	updated_ts: string
	created_ts: string
}

export type NotesListResponse = {
	data: NotesListItem[]
	count: number
}

export async function listNotes(params?: {
	skip?: number
	limit?: number
}): Promise<NotesListResponse> {
	const { skip = 0, limit = 100 } = params ?? {}
	return request<NotesListResponse>(OpenAPI, {
		method: "GET",
		url: "/notes/",
		query: { skip, limit } as Record<string, string | number>,
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

export async function updateNote(
	id: string,
	body: { title?: string | null },
): Promise<NoteOut> {
	return request<NoteOut>(OpenAPI, {
		method: "PATCH",
		url: `/notes/${id}`,
		body,
		mediaType: "application/json",
		errors: { 422: "Validation Error" },
	}) as Promise<NoteOut>
}

export async function createNote(body?: {
	title?: string | null
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
