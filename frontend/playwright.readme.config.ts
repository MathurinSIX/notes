import path from "node:path"
import { fileURLToPath } from "node:url"
import { config as loadEnv } from "dotenv"
import { defineConfig, devices } from "@playwright/test"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Optional: pick up FIRST_SUPERUSER_* for screenshot login when not set in the shell. */
loadEnv({ path: path.resolve(__dirname, "../.env.development") })

const readmeBaseUrl =
	process.env.README_BASE_URL?.trim() || "http://localhost:3000"

/**
 * README screenshots: builds preview with same-origin API (`VITE_API_SAME_ORIGIN`);
 * the test bridges XHR to Traefik via `README_API_URL` / `DOMAIN` (see readme-screenshots.spec.ts).
 */
export default defineConfig({
	testDir: "./tests",
	testMatch: "readme-screenshots.spec.ts",
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
				command: `VITE_README_SCREENSHOTS=1 VITE_API_SAME_ORIGIN=1 npm run build && VITE_README_SCREENSHOTS=1 VITE_API_SAME_ORIGIN=1 npm run preview`,
				url: readmeBaseUrl,
				reuseExistingServer: !process.env.CI,
				timeout: 180_000,
		  },
})
