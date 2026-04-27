import { mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
	expect,
	test,
	type APIRequestContext,
	type Page,
} from "@playwright/test"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const screenshotDir = path.resolve(__dirname, "../../docs/screenshots")

/** Origin for Node-side API calls (Playwright `APIRequestContext`). */
function apiOriginAndHost(): { origin: string; hostHeader?: string } {
	const fromEnv = process.env.README_API_URL?.trim()
	if (fromEnv) {
		return { origin: fromEnv.replace(/\/$/, "") }
	}
	const domain = process.env.DOMAIN?.trim() || "notes.localhost"
	return {
		origin: "http://127.0.0.1",
		hostHeader: `backend.${domain}`,
	}
}

function apiHeaders(base: Record<string, string>): Record<string, string> {
	const { hostHeader } = apiOriginAndHost()
	return hostHeader ? { ...base, Host: hostHeader } : base
}

type TokenPair = { access_token: string; refresh_token: string }

async function waitForScreenshotStable(page: Page) {
	await page.waitForLoadState("networkidle")
	await page.waitForTimeout(350)
}

function matchesReadmeApiPath(pathname: string): boolean {
	const prefixes = [
		"/login",
		"/users",
		"/notes",
		"/chunks",
		"/run",
		"/workflow",
		"/health",
		"/live",
	] as const
	return prefixes.some(
		(p) => pathname === p || pathname.startsWith(`${p}/`),
	)
}

async function fetchTokens(
	request: APIRequestContext,
	username: string,
	password: string,
): Promise<TokenPair> {
	const { origin } = apiOriginAndHost()
	const tokenRes = await request.post(`${origin}/login/access-token`, {
		headers: apiHeaders({
			"Content-Type": "application/x-www-form-urlencoded",
		}),
		data: new URLSearchParams({
			username,
			password,
		}).toString(),
	})
	if (!tokenRes.ok()) {
		const body = await tokenRes.text()
		throw new Error(
			`Login API failed (HTTP ${tokenRes.status()}): ${body}. Start the dev stack (e.g. just up-dev) or set README_API_URL to your API base.`,
		)
	}
	return (await tokenRes.json()) as TokenPair
}

test.describe.configure({ mode: "serial" })

test("README screenshots", async ({ page, context }) => {
	await mkdir(screenshotDir, { recursive: true })
	let mockActionsApi = false
	let mockActionsNoteId = ""
	let mockActionsNoteTitle = ""

	await page.route("**/*", async (route) => {
		const req = route.request()
		if (req.resourceType() === "document") {
			await route.continue()
			return
		}
		let url: URL
		try {
			url = new URL(req.url())
		} catch {
			await route.continue()
			return
		}
		const port = url.port || (url.protocol === "https:" ? "443" : "80")
		const onVitePreview =
			(url.hostname === "localhost" && port === "3000") ||
			(url.hostname === "127.0.0.1" && port === "3000")
		if (!onVitePreview) {
			await route.continue()
			return
		}
		if (!matchesReadmeApiPath(url.pathname)) {
			await route.continue()
			return
		}
		const { origin } = apiOriginAndHost()
		const upstream = `${origin}${url.pathname}${url.search}`
		const fwd: Record<string, string> = {}
		for (const { name, value } of await req.headersArray()) {
			const ln = name.toLowerCase()
			if (
				["content-length", "host", "connection", "accept-encoding"].includes(
					ln,
				)
			) {
				continue
			}
			fwd[name] = value
		}
		const headers = apiHeaders(fwd)
		const buf = req.postDataBuffer()
		const resp = await context.request.fetch(upstream, {
			method: req.method(),
			headers,
			...(buf ? { data: buf } : {}),
		})
		if (
			mockActionsApi &&
			req.method() === "GET" &&
			url.pathname === "/notes/" &&
			url.searchParams.get("archived") === "false"
		) {
			const body = (await resp.json()) as {
				data: Array<{
					id: string
					title: string | null
					description: string | null
					archived: boolean
					updated_ts: string
					created_ts: string
					pending_task_count?: number
				}>
				count: number
			}
			const nowIso = new Date().toISOString()
			const inTwoHoursIso = new Date(
				Date.now() + 2 * 60 * 60 * 1000,
			).toISOString()
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					...body,
					next_actions: [
						{
							note_id: mockActionsNoteId,
							note_title: mockActionsNoteTitle,
							task_id: "00000000-0000-4000-8000-000000000001",
							task_title: "Ship README screenshots",
							due_at: inTwoHoursIso,
						},
					],
					recent_done_actions: [
						{
							note_id: mockActionsNoteId,
							note_title: mockActionsNoteTitle,
							task_id: "00000000-0000-4000-8000-000000000002",
							task_title: "Draft note description",
							due_at: null,
							done_updated_ts: nowIso,
						},
					],
				}),
			})
			return
		}
		await route.fulfill({ response: resp })
	})

	const username =
		process.env.README_SCREENSHOT_USERNAME?.trim() ||
		process.env.README_SCREENSHOT_EMAIL?.trim() ||
		process.env.FIRST_SUPERUSER_USERNAME?.trim() ||
		process.env.FIRST_SUPERUSER_EMAIL?.trim() ||
		"admin"
	const password =
		process.env.README_SCREENSHOT_PASSWORD?.trim() ||
		process.env.FIRST_SUPERUSER_PASSWORD?.trim() ||
		"admin"

	await context.clearCookies()
	await page.goto("/login")
	await page.evaluate(() => {
		localStorage.clear()
		sessionStorage.clear()
	})
	await page.goto("/login")
	await expect(page.getByPlaceholder("Username")).toBeVisible()
	await waitForScreenshotStable(page)
	await page.screenshot({
		path: path.join(screenshotDir, "login.png"),
		fullPage: true,
	})

	const tokens = await fetchTokens(context.request, username, password)
	const { origin: apiOrigin } = apiOriginAndHost()

	await page.evaluate(
		({ access_token, refresh_token }) => {
			localStorage.setItem("access_token", access_token)
			localStorage.setItem("refresh_token", refresh_token)
		},
		tokens,
	)

	await page.goto("/notes")
	await expect(page.getByRole("heading", { name: "Notes" })).toBeVisible({
		timeout: 30_000,
	})
	await expect(page.getByRole("button", { name: "New note" })).toBeVisible()
	await waitForScreenshotStable(page)
	await page.screenshot({
		path: path.join(screenshotDir, "notes.png"),
		fullPage: true,
	})

	await page.getByRole("button", { name: "New note" }).click()
	await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}/i, { timeout: 30_000 })
	const noteId = new URL(page.url()).pathname.split("/").pop()
	if (!noteId) {
		throw new Error("Could not parse note id from URL")
	}

	const metaRes = await context.request.patch(
		`${apiOrigin}/notes/${noteId}`,
		{
			headers: apiHeaders({
				Authorization: `Bearer ${tokens.access_token}`,
				"Content-Type": "application/json",
			}),
			data: JSON.stringify({
				title: "README screenshot note",
				description:
					"Sample title, description, and markdown section for documentation captures.",
			}),
		},
	)
	if (!metaRes.ok()) {
		throw new Error(
			`Patch note failed (HTTP ${metaRes.status()}): ${await metaRes.text()}`,
		)
	}

	const readRes = await context.request.get(`${apiOrigin}/notes/${noteId}`, {
		headers: apiHeaders({
			Authorization: `Bearer ${tokens.access_token}`,
			Accept: "application/json",
		}),
	})
	if (!readRes.ok()) {
		throw new Error(
			`Read note failed (HTTP ${readRes.status()}): ${await readRes.text()}`,
		)
	}
	const full = (await readRes.json()) as { chunks: { id: string }[] }
	const chunkId = full.chunks?.[0]?.id
	if (!chunkId) {
		throw new Error("Expected at least one chunk on new note")
	}

	const patchRes = await context.request.patch(
		`${apiOrigin}/chunks/${chunkId}`,
		{
			headers: apiHeaders({
				Authorization: `Bearer ${tokens.access_token}`,
				"Content-Type": "application/json",
			}),
			data: JSON.stringify({
				body_md:
					"# Meeting notes\n\nDecisions and **next steps** from the merge workflow.\n\n- Align on API contract\n- Ship README screenshots",
			}),
		},
	)
	if (!patchRes.ok()) {
		throw new Error(
			`Patch chunk failed (HTTP ${patchRes.status()}): ${await patchRes.text()}`,
		)
	}

	await page.reload()
	await expect(
		page.getByRole("heading", {
			level: 1,
			name: "README screenshot note",
		}),
	).toBeVisible({ timeout: 30_000 })
	await expect(
		page.getByRole("button", { name: "History" }).first(),
	).toBeVisible()
	await waitForScreenshotStable(page)
	await page.screenshot({
		path: path.join(screenshotDir, "note-detail.png"),
		fullPage: true,
	})

	await page.getByRole("button", { name: "History" }).first().click()
	await expect(
		page.getByRole("heading", { name: "Change history" }),
	).toBeVisible()
	await waitForScreenshotStable(page)
	await page.screenshot({
		path: path.join(screenshotDir, "note-change-history.png"),
		fullPage: true,
	})
	await page.keyboard.press("Escape")
	await expect(
		page.getByRole("heading", { name: "Change history" }),
	).toBeHidden()

	await page.getByRole("button", { name: "Incoming updates" }).click()
	await expect(
		page.getByRole("heading", { name: "Incoming updates" }),
	).toBeVisible()
	await waitForScreenshotStable(page)
	await page.screenshot({
		path: path.join(screenshotDir, "note-incoming-updates.png"),
		fullPage: true,
	})
	await page.keyboard.press("Escape")

	await page.goto("/notes")
	await page
		.locator("header")
		.getByRole("button", { name: "Update notes" })
		.click()
	await expect(
		page.getByRole("heading", { name: "Update notes" }),
	).toBeVisible()
	await waitForScreenshotStable(page)
	await page.screenshot({
		path: path.join(screenshotDir, "update-notes-modal.png"),
		fullPage: true,
	})
	await page.getByLabel("Update text").fill(
		[
			"Weekly sync update:",
			"- API contract finalized",
			"- Need follow-up with design on empty states",
			"- Move release checklist to next Friday",
		].join("\n"),
	)
	await waitForScreenshotStable(page)
	await page.screenshot({
		path: path.join(screenshotDir, "update-notes-example.png"),
		fullPage: true,
	})
	await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click()

	mockActionsApi = true
	mockActionsNoteId = noteId
	mockActionsNoteTitle = "README screenshot note"
	await page.goto("/notes/actions")
	await expect(
		page.getByRole("heading", { level: 1, name: "Actions" }),
	).toBeVisible({ timeout: 30_000 })
	await expect(page.getByText("Ship README screenshots")).toBeVisible()
	await waitForScreenshotStable(page)
	await page.screenshot({
		path: path.join(screenshotDir, "actions.png"),
		fullPage: true,
	})
	mockActionsApi = false

	await page.goto("/notes/updates")
	await expect(
		page.getByRole("heading", { name: "Sent updates" }),
	).toBeVisible({
		timeout: 30_000,
	})
	await waitForScreenshotStable(page)
	await page.screenshot({
		path: path.join(screenshotDir, "sent-updates.png"),
		fullPage: true,
	})

	await context.request.delete(`${apiOrigin}/notes/${noteId}`, {
		headers: apiHeaders({
			Authorization: `Bearer ${tokens.access_token}`,
		}),
	})
})
