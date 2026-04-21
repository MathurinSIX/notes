import moment from "moment-timezone"

/**
 * Relative due label, e.g. "In 3 days", "Yesterday", "2 hours ago".
 * First character is uppercased so it reads well as a sentence prefix ("Due …").
 */
export function formatDueRelative(
	iso: string | null | undefined,
): string | null {
	if (iso == null || iso === "") return null
	const m = moment(iso)
	if (!m.isValid()) return null
	const rel = m.fromNow()
	return rel.charAt(0).toUpperCase() + rel.slice(1)
}

/** Absolute date/time for tooltips (locale-aware long form). */
export function formatDueAbsoluteTitle(
	iso: string | null | undefined,
): string | null {
	if (iso == null || iso === "") return null
	const m = moment(iso)
	if (!m.isValid()) return null
	return m.format("LLL")
}

/** True if the instant is strictly before now (same idea as prior `Date < now`). */
export function isDueOverdue(iso: string | null | undefined): boolean {
	if (iso == null || iso === "") return false
	const m = moment(iso)
	if (!m.isValid()) return false
	return m.isBefore(moment())
}

/** True if due is still in the future and less than 24 hours away (show as urgent). */
export function isDueWithinTwentyFourHours(
	iso: string | null | undefined,
): boolean {
	if (iso == null || iso === "") return false
	const m = moment(iso)
	if (!m.isValid()) return false
	const now = moment()
	if (!m.isAfter(now)) return false
	return m.diff(now, "seconds", true) < 24 * 60 * 60
}

/** `datetime-local` value in the user's zone from an API ISO timestamp. */
export function dueAtToDatetimeLocalValue(
	iso: string | null | undefined,
): string {
	if (iso == null || iso === "") return ""
	const m = moment(iso)
	if (!m.isValid()) return ""
	return m.format("YYYY-MM-DDTHH:mm")
}

/** UTC ISO string for PATCH, or null when the input is empty (clear due). */
export function datetimeLocalValueToIsoUtc(
	value: string | null | undefined,
): string | null {
	if (value == null || value === "") return null
	const m = moment(value, "YYYY-MM-DDTHH:mm", true)
	if (!m.isValid()) return null
	return m.toISOString()
}

/** Whether two API-style due instants represent the same moment (or both absent). */
export function dueInstantsEqual(
	a: string | null | undefined,
	b: string | null | undefined,
): boolean {
	const emptyA = a == null || a === ""
	const emptyB = b == null || b === ""
	if (emptyA && emptyB) return true
	if (emptyA || emptyB) return false
	const ma = moment(a)
	const mb = moment(b)
	if (!ma.isValid() || !mb.isValid()) return false
	return ma.valueOf() === mb.valueOf()
}
