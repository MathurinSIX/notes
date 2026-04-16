import { OpenAPI } from "@/client"
import { LoginService } from "@/client/services"
import { getRefreshToken, logout, setTokens } from "@/hooks/useAuth"
import axios, {
	type AxiosResponse,
	type InternalAxiosRequestConfig,
} from "axios"

let interceptorSetup = false

/**
 * Attempt to refresh the access token using the refresh token.
 * Returns true on success, false on failure.
 */
async function tryRefresh(): Promise<boolean> {
	const refreshToken = getRefreshToken()
	if (!refreshToken) return false
	try {
		const token = await LoginService.refreshToken({
			requestBody: { refresh_token: refreshToken },
		})
		setTokens(token.access_token, token.refresh_token)
		return true
	} catch {
		return false
	}
}

/**
 * Sets up a response interceptor that on 401 tries to refresh the token and retries the request.
 * The OpenAPI client passes 401 responses to the success handler (not error handler), so we must
 * handle 401 in the response handler. Interceptors.use() only accepts one function.
 */
export function setup401Interceptor() {
	if (interceptorSetup) {
		return
	}

	OpenAPI.interceptors.response.use(async (response: AxiosResponse) => {
		if (response?.status !== 401) {
			return response
		}
		const config = response.config as InternalAxiosRequestConfig & {
			_retried?: boolean
		}
		// Do not try refresh when the failing request was the refresh endpoint itself
		if (config?.url?.includes("/login/refresh")) {
			logout()
			return response
		}
		// Avoid infinite retry: only attempt refresh once per request
		if (config._retried) {
			logout()
			return response
		}
		const refreshed = await tryRefresh()
		if (!refreshed) {
			logout()
			return response
		}
		config._retried = true
		// Retry the original request with the new access token
		config.headers = config.headers ?? {}
		config.headers.Authorization = `Bearer ${localStorage.getItem(
			"access_token",
		)}`
		return axios.request(config)
	})

	interceptorSetup = true
}
