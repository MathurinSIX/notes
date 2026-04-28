import type { APIRequestContext, BrowserContext, Page } from "@playwright/test"

/** Origin for Node-side API calls (Playwright `APIRequestContext`). */
export function readmeApiOriginAndHost(): {
	origin: string
	hostHeader?: string
} {
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

export function readmeApiHeaders(
	base: Record<string, string>,
): Record<string, string> {
	const { hostHeader } = readmeApiOriginAndHost()
	return hostHeader ? { ...base, Host: hostHeader } : base
}

export type TokenPair = { access_token: string; refresh_token: string }

export async function readmeFetchTokens(
	request: APIRequestContext,
	username: string,
	password: string,
): Promise<TokenPair> {
	const { origin } = readmeApiOriginAndHost()
	const tokenRes = await request.post(`${origin}/login/access-token`, {
		headers: readmeApiHeaders({
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

export async function waitForScreenshotStable(page: Page) {
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
	return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export type ReadmeListNotesMockState = {
	enabled: boolean
	noteId: string
	noteTitle: string
}

/**
 * Forwards same-origin API calls from the Vite preview port to the real backend
 * (Traefik / README_API_URL), matching the README screenshot workflow.
 */
export async function installReadmeViteApiBridge(
	page: Page,
	context: BrowserContext,
	getListNotesMock: () => ReadmeListNotesMockState,
) {
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
		const previewPort = process.env.README_PREVIEW_PORT?.trim() || "4173"
		const onVitePreview =
			(url.hostname === "localhost" && port === previewPort) ||
			(url.hostname === "127.0.0.1" && port === previewPort)
		if (!onVitePreview) {
			await route.continue()
			return
		}
		if (!matchesReadmeApiPath(url.pathname)) {
			await route.continue()
			return
		}
		const { origin } = readmeApiOriginAndHost()
		const upstream = `${origin}${url.pathname}${url.search}`
		const fwd: Record<string, string> = {}
		for (const { name, value } of await req.headersArray()) {
			const ln = name.toLowerCase()
			if (
				[
					"content-length",
					"host",
					"connection",
					"accept-encoding",
				].includes(ln)
			) {
				continue
			}
			fwd[name] = value
		}
		const headers = readmeApiHeaders(fwd)
		const buf = req.postDataBuffer()
		const resp = await context.request.fetch(upstream, {
			method: req.method(),
			headers,
			...(buf ? { data: buf } : {}),
		})
		const mock = getListNotesMock()
		if (
			mock.enabled &&
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
							note_id: mock.noteId,
							note_title: mock.noteTitle,
							task_id: "00000000-0000-4000-8000-000000000001",
							task_title: "Ship README screenshots",
							due_at: inTwoHoursIso,
						},
					],
					recent_done_actions: [
						{
							note_id: mock.noteId,
							note_title: mock.noteTitle,
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
}

export function readmeCredentials(): { username: string; password: string } {
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
	return { username, password }
}
