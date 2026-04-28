import { mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { expect, test } from "@playwright/test"
import {
	type ReadmeListNotesMockState,
	installReadmeViteApiBridge,
	readmeApiHeaders,
	readmeApiOriginAndHost,
	readmeCredentials,
	readmeFetchTokens,
	waitForScreenshotStable,
} from "./readme-api-bridge"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const screenshotDir = path.resolve(__dirname, "../../docs/screenshots")

test.describe.configure({ mode: "serial" })

test("README screenshots", async ({ page, context }) => {
	await mkdir(screenshotDir, { recursive: true })
	const listNotesMock: ReadmeListNotesMockState = {
		enabled: false,
		noteId: "",
		noteTitle: "",
	}
	await installReadmeViteApiBridge(page, context, () => listNotesMock)

	const { username, password } = readmeCredentials()

	await context.clearCookies()
	await page.goto("/login")
	await page.evaluate(() => {
		localStorage.clear()
		sessionStorage.clear()
	})
	await page.goto("/login")
	await expect(page.getByPlaceholder("Username")).toBeVisible({
		timeout: 30_000,
	})
	await waitForScreenshotStable(page)
	await page.screenshot({
		path: path.join(screenshotDir, "login.png"),
		fullPage: true,
	})

	const tokens = await readmeFetchTokens(context.request, username, password)
	const { origin: apiOrigin } = readmeApiOriginAndHost()

	await page.evaluate(({ access_token, refresh_token }) => {
		localStorage.setItem("access_token", access_token)
		localStorage.setItem("refresh_token", refresh_token)
	}, tokens)

	await page.goto("/")
	await expect(
		page.getByRole("region", { name: "Next actions" }),
	).toBeVisible({ timeout: 30_000 })
	await waitForScreenshotStable(page)
	await page.screenshot({
		path: path.join(screenshotDir, "home.png"),
		fullPage: true,
	})

	await page.goto("/notes")
	await expect(page.getByRole("tab", { name: "Active" })).toBeVisible({
		timeout: 30_000,
	})
	await expect(page.getByRole("button", { name: "New note" })).toBeVisible()
	await waitForScreenshotStable(page)
	await page.screenshot({
		path: path.join(screenshotDir, "notes.png"),
		fullPage: true,
	})

	await page.getByRole("button", { name: "New note" }).click()
	await expect(page.getByRole("heading", { name: "New note" })).toBeVisible()
	await expect(page.getByRole("textbox", { name: "Title" })).toBeVisible()
	await page
		.getByRole("textbox", { name: "Title" })
		.fill("README screenshot note")
	await page
		.getByRole("textbox", { name: "Description" })
		.fill(
			"Sample title, description, and markdown section for documentation captures.",
		)
	await page.getByRole("button", { name: "Create" }).click()
	await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}/i, {
		timeout: 30_000,
	})
	const noteId = new URL(page.url()).pathname.split("/").pop()
	if (!noteId) {
		throw new Error("Could not parse note id from URL")
	}

	const readRes = await context.request.get(`${apiOrigin}/notes/${noteId}`, {
		headers: readmeApiHeaders({
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
			headers: readmeApiHeaders({
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
		page.getByRole("button", { name: "Change history" }).first(),
	).toBeVisible()
	await waitForScreenshotStable(page)
	await page.screenshot({
		path: path.join(screenshotDir, "note-detail.png"),
		fullPage: true,
	})

	await page.getByRole("button", { name: "Change history" }).first().click()
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

	await page.getByRole("button", { name: "Sources" }).click()
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
	await page.getByRole("button", { name: "Update notes" }).click()
	await expect(
		page.getByRole("heading", { name: "Update notes" }),
	).toBeVisible()
	await waitForScreenshotStable(page)
	const updateNotesDialog = page
		.getByRole("dialog")
		.filter({ has: page.getByRole("heading", { name: "Update notes" }) })
	await updateNotesDialog.screenshot({
		path: path.join(screenshotDir, "update-notes-modal.png"),
	})
	await page
		.getByLabel("Text to merge")
		.fill(
			[
				"Weekly sync update:",
				"- API contract finalized",
				"- Need follow-up with design on empty states",
				"- Move release checklist to next Friday",
			].join("\n"),
		)
	await waitForScreenshotStable(page)
	await updateNotesDialog.screenshot({
		path: path.join(screenshotDir, "update-notes-example.png"),
	})
	await page
		.getByRole("dialog")
		.getByRole("button", { name: "Cancel" })
		.click()

	listNotesMock.enabled = true
	listNotesMock.noteId = noteId
	listNotesMock.noteTitle = "README screenshot note"
	await page.goto("/notes/actions")
	await expect(
		page.getByRole("region", { name: "Next actions" }),
	).toBeVisible({ timeout: 30_000 })
	await expect(page.getByText("Ship README screenshots")).toBeVisible()
	await waitForScreenshotStable(page)
	await page.screenshot({
		path: path.join(screenshotDir, "actions.png"),
		fullPage: true,
	})
	listNotesMock.enabled = false

	await page.goto("/notes/updates")
	await expect(
		page
			.getByRole("region", { name: "Sent updates" })
			.or(page.getByText(/send text for background merge/i)),
	).toBeVisible({
		timeout: 30_000,
	})
	await waitForScreenshotStable(page)
	await page.screenshot({
		path: path.join(screenshotDir, "sent-updates.png"),
		fullPage: true,
	})

	await context.request.delete(`${apiOrigin}/notes/${noteId}`, {
		headers: readmeApiHeaders({
			Authorization: `Bearer ${tokens.access_token}`,
		}),
	})
})
