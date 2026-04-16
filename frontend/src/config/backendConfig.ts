/** Base URL for the FastAPI backend (browser). */
export function getApiUrl(): string {
	const fromEnv = import.meta.env.VITE_API_URL?.trim()
	if (fromEnv) return fromEnv

	const hostname = window.location.hostname
	if (hostname === "localhost") {
		return "http://backend.localhost"
	}
	return `${window.location.protocol}//backend.${hostname}`
}
