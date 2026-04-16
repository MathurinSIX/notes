import { defineConfig, devices } from "@playwright/test"

const readmeApiUrl =
	process.env.README_API_URL?.trim() || "http://127.0.0.1:8000"
const readmeBaseUrl =
	process.env.README_BASE_URL?.trim() || "http://localhost:3000"

/**
 * README screenshots: starts Vite (see webServer) and opens README_BASE_URL.
 * Set README_API_URL to a reachable FastAPI base (browser + token request), e.g.
 * `http://127.0.0.1:8000` when the backend is published on the host loopback.
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
				command: `VITE_API_URL=${readmeApiUrl} npm run build && VITE_API_URL=${readmeApiUrl} npm run preview`,
				url: readmeBaseUrl,
				reuseExistingServer: !process.env.CI,
				timeout: 180_000,
		  },
})
