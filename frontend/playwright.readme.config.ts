import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, devices } from "@playwright/test"
import { config as loadEnv } from "dotenv"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Optional: pick up FIRST_SUPERUSER_* for screenshot login when not set in the shell. */
loadEnv({ path: path.resolve(__dirname, "../.env.development") })
loadEnv({ path: path.resolve(__dirname, "../.env"), override: true })

/** Dedicated port so `npm run screenshots:readme` does not attach to another app on :3000. */
const readmePreviewPort = process.env.README_PREVIEW_PORT?.trim() || "4173"
const readmeBaseUrl =
	process.env.README_BASE_URL?.trim() ||
	`http://127.0.0.1:${readmePreviewPort}`

/**
 * README screenshots: builds preview with same-origin API (`VITE_API_SAME_ORIGIN`);
 * the test bridges XHR to Traefik via `README_API_URL` / `DOMAIN` (see `tests/readme-api-bridge.ts`).
 */
export default defineConfig({
	testDir: "./tests",
	testMatch: ["readme-screenshots.spec.ts", "readme-theme-gif.spec.ts"],
	fullyParallel: false,
	workers: 1,
	reporter: "list",
	timeout: 120_000,
	use: {
		baseURL: readmeBaseUrl,
		...devices["Desktop Chrome"],
		viewport: { width: 1280, height: 800 },
		trace: "off",
	},
	webServer: process.env.README_SKIP_VITE
		? undefined
		: {
				command: `VITE_README_SCREENSHOTS=1 VITE_API_SAME_ORIGIN=1 npm run build && VITE_README_SCREENSHOTS=1 VITE_API_SAME_ORIGIN=1 npx vite preview --host 127.0.0.1 --port ${readmePreviewPort}`,
				url: readmeBaseUrl,
				reuseExistingServer: !process.env.CI,
				timeout: 180_000,
		  },
})
