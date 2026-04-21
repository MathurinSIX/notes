/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
	readonly VITE_API_URL?: string
	/** When `"1"`, API calls use same-origin URLs (see Vite proxy for README screenshots). */
	readonly VITE_API_SAME_ORIGIN?: string
}
