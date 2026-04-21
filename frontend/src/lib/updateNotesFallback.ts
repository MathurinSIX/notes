/** Remember which note the user had open so “Update notes” can default there when the URL is not `/notes/:id`. */

const STORAGE_KEY = "update_notes_fallback_note_id"

const NOTE_UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function rememberUpdateNotesFallbackNoteId(noteId: string): void {
	if (!NOTE_UUID_RE.test(noteId)) return
	try {
		sessionStorage.setItem(STORAGE_KEY, noteId)
	} catch {
		/* private mode / quota */
	}
}

export function readStoredUpdateNotesFallbackNoteId(): string | undefined {
	if (typeof window === "undefined") return undefined
	try {
		const v = sessionStorage.getItem(STORAGE_KEY)
		if (v && NOTE_UUID_RE.test(v)) return v
	} catch {
		/* ignore */
	}
	return undefined
}
