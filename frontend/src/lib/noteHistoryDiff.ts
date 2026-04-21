import type {
	ChunkHistoryEvent,
	NoteHistoryEvent,
	TaskHistoryEvent,
} from "@/api/notes"

export type AnyHistoryEvent =
	| NoteHistoryEvent
	| ChunkHistoryEvent
	| TaskHistoryEvent

export function findPreviousChunkEvent(
	events: AnyHistoryEvent[],
	fromIndex: number,
	chunkId: string,
): ChunkHistoryEvent | null {
	for (let j = fromIndex + 1; j < events.length; j++) {
		const ev = events[j]
		if (ev.kind === "chunk" && ev.chunk_id === chunkId) {
			return ev
		}
	}
	return null
}

export function findPreviousNoteEvent(
	events: AnyHistoryEvent[],
	fromIndex: number,
): NoteHistoryEvent | null {
	for (let j = fromIndex + 1; j < events.length; j++) {
		const ev = events[j]
		if (ev.kind === "note") {
			return ev
		}
	}
	return null
}

export function findPreviousTaskEvent(
	events: AnyHistoryEvent[],
	fromIndex: number,
	taskId: string,
): TaskHistoryEvent | null {
	for (let j = fromIndex + 1; j < events.length; j++) {
		const ev = events[j]
		if (ev.kind === "task" && ev.task_id === taskId) {
			return ev
		}
	}
	return null
}

/** Plain-text bounds for a git-style chunk body diff at one history row. */
export function chunkHistoryDiffText(
	event: ChunkHistoryEvent,
	previous: ChunkHistoryEvent | null,
): { before: string; after: string } {
	if (event.deleted) {
		const priorBody =
			previous && !previous.deleted ? previous.body_md : event.body_md
		return { before: priorBody, after: "" }
	}
	return { before: previous?.body_md ?? "", after: event.body_md }
}
