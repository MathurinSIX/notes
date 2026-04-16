import { LoginService } from "@/client/services"

const REFRESH_TOKEN_KEY = "refresh_token"

function applyTokensFromUrl(): void {
	if (typeof window === "undefined") return

	const params = new URLSearchParams(window.location.search)

	if (params.get("access_token")) {
		localStorage.setItem("access_token", params.get("access_token") || "")
		const refresh = params.get("refresh_token")
		if (refresh) {
			localStorage.setItem(REFRESH_TOKEN_KEY, refresh)
		}
		// Remove tokens from URL
		params.delete("access_token")
		params.delete("refresh_token")
		const cleanSearch = params.toString()
		const cleanUrl = `${window.location.pathname}${
			cleanSearch ? `?${cleanSearch}` : ""
		}${window.location.hash}`
		window.history.replaceState(null, "", cleanUrl)
	}
}

const isLoggedIn = () => {
	if (typeof window === "undefined") {
		return false
	}
	applyTokensFromUrl()
	return localStorage.getItem("access_token") !== null
}

/**
 * Checks if the user is logged in. If only a refresh token exists, attempts to refresh
 * and returns true if successful. Call this before redirecting to login.
 */
async function ensureLoggedIn(): Promise<boolean> {
	if (typeof window === "undefined") return false

	applyTokensFromUrl()

	if (localStorage.getItem("access_token")) {
		return true
	}

	const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
	if (!refreshToken) return false

	try {
		const token = await LoginService.refreshToken({
			requestBody: { refresh_token: refreshToken },
		})
		localStorage.setItem("access_token", token.access_token)
		localStorage.setItem(REFRESH_TOKEN_KEY, token.refresh_token)
		return true
	} catch {
		return false
	}
}

const logout = () => {
	if (typeof window === "undefined") {
		return
	}

	localStorage.removeItem("access_token")
	localStorage.removeItem(REFRESH_TOKEN_KEY)
	sessionStorage.setItem("return_to", window.location.pathname)
	window.location.pathname = "/login"
}

/**
 * Store tokens from a login or refresh response.
 */
const setTokens = (accessToken: string, refreshToken: string) => {
	if (typeof window === "undefined") return
	localStorage.setItem("access_token", accessToken)
	localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

const getRefreshToken = (): string | null => {
	if (typeof window === "undefined") return null
	return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export { ensureLoggedIn, isLoggedIn, logout, setTokens, getRefreshToken }
