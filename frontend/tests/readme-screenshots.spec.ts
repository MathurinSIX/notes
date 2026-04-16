import { mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { expect, test } from "@playwright/test"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const screenshotDir = path.resolve(__dirname, "../../docs/screenshots")

function apiBaseUrl(): string {
	const fromEnv = process.env.README_API_URL?.trim()
	if (fromEnv) return fromEnv.replace(/\/$/, "")
	return "http://127.0.0.1:8000"
}

test.describe.configure({ mode: "serial" })

test("README screenshots", async ({ page, context }) => {
	await mkdir(screenshotDir, { recursive: true })

	const email =
		process.env.README_SCREENSHOT_EMAIL?.trim() || "admin@localhost"
	const password = process.env.README_SCREENSHOT_PASSWORD?.trim() || "admin"

	await context.clearCookies()
	await page.goto("/login")
	await page.evaluate(() => {
		localStorage.clear()
		sessionStorage.clear()
	})
	await page.goto("/login")
	await expect(page.getByPlaceholder("Email")).toBeVisible()
	await page.screenshot({
		path: path.join(screenshotDir, "login.png"),
		fullPage: true,
	})

	const tokenRes = await page.request.post(
		`${apiBaseUrl()}/login/access-token`,
		{
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			data: new URLSearchParams({
				username: email,
				password,
			}).toString(),
		},
	)
	if (!tokenRes.ok()) {
		const body = await tokenRes.text()
		throw new Error(
			`Login API failed (HTTP ${tokenRes.status()}): ${body}. Start the dev stack (e.g. just up-dev) or set README_API_URL to your API base.`,
		)
	}
	const tokenJson = (await tokenRes.json()) as {
		access_token: string
		refresh_token: string
	}

	await page.evaluate(
		({ access_token, refresh_token }) => {
			localStorage.setItem("access_token", access_token)
			localStorage.setItem("refresh_token", refresh_token)
		},
		{
			access_token: tokenJson.access_token,
			refresh_token: tokenJson.refresh_token,
		},
	)

	await page.goto("/")
	await expect(page.getByRole("heading", { name: /^Welcome/ })).toBeVisible({
		timeout: 30_000,
	})
	await expect(page.getByRole("button", { name: "Summarize" })).toBeVisible()
	await page.screenshot({
		path: path.join(screenshotDir, "home.png"),
		fullPage: true,
	})
})
