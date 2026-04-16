import type { ApiError } from "./client"

export const emailPattern = {
	value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
	message: "Invalid email address",
}

export const namePattern = {
	value: /^[A-Za-z\s\u00C0-\u017F]{1,30}$/,
	message: "Invalid name",
}

export const passwordRules = (isRequired = true) => {
	const rules: any = {
		minLength: {
			value: 8,
			message: "Password must be at least 8 characters",
		},
	}

	if (isRequired) {
		rules.required = "Password is required"
	}

	return rules
}

export const confirmPasswordRules = (
	getValues: () => any,
	isRequired = true,
) => {
	const rules: any = {
		validate: (value: string) => {
			const password = getValues().password || getValues().new_password
			return value === password ? true : "The passwords do not match"
		},
	}

	if (isRequired) {
		rules.required = "Password confirmation is required"
	}

	return rules
}

export const handleError = (err: ApiError, showToast: any) => {
	const errDetail = (err.body as any)?.detail
	let errorMessage = errDetail || "Something went wrong."
	if (Array.isArray(errDetail) && errDetail.length > 0) {
		errorMessage = errDetail[0].msg
	}
	showToast("Error", errorMessage, "error")
}

export function uniqBy<T, K extends keyof any>(
	array: T[],
	key: (item: T) => K,
): T[] {
	const seen: Record<K, boolean> = {} as Record<K, boolean>
	return array.filter((item) => {
		const k = key(item)
		if (seen[k]) {
			return false
		}
		seen[k] = true
		return true
	})
}

export function deepCopy(value: any) {
	return JSON.parse(JSON.stringify(value))
}

export const formatRelativeTime = (dateString: string): string => {
	// Parse the date string and ensure we're working with UTC for calculations
	const date = new Date(dateString)
	const now = new Date()

	// Convert both dates to UTC for accurate time difference calculation
	const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000)
	const utcNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000)

	const diffInMs = utcNow.getTime() - utcDate.getTime()
	const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
	const diffInDays = Math.floor(diffInHours / 24)

	if (diffInHours < 1) {
		const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
		if (diffInMinutes < 1) {
			return "Just now"
		}
		return `${diffInMinutes} ${
			diffInMinutes === 1 ? "minute" : "minutes"
		} ago`
	}
	if (diffInHours < 24) {
		return `${diffInHours} ${diffInHours === 1 ? "hour" : "hours"} ago`
	}
	if (diffInDays < 30) {
		return `${diffInDays} ${diffInDays === 1 ? "day" : "days"} ago`
	}
	// For older dates, show the full date with timezone info
	return date.toLocaleDateString("en-US", {
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "UTC", // Display in UTC to avoid confusion
	})
}

// Optional: Add a function to format with explicit timezone display
export const formatDateWithTimezone = (
	dateString: string,
	showTimezone = true,
): string => {
	const date = new Date(dateString)

	const options: Intl.DateTimeFormatOptions = {
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		...(showTimezone && { timeZoneName: "short" }),
	}

	return date.toLocaleString("en-US", options)
}
