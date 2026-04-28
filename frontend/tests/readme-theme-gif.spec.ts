import { execFileSync } from "node:child_process"
import { mkdir, unlink } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { expect, test } from "@playwright/test"
import {
	type ReadmeListNotesMockState,
	installReadmeViteApiBridge,
	readmeCredentials,
	readmeFetchTokens,
} from "./readme-api-bridge"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const screenshotDir = path.resolve(__dirname, "../../docs/screenshots")

test.use({
	video: { mode: "on", size: { width: 560, height: 360 } },
})

function tryWebmToGif(webmPath: string, gifPath: string) {
	try {
		execFileSync(
			"ffmpeg",
			[
				"-y",
				"-i",
				webmPath,
				"-t",
				"1.85",
				"-vf",
				"fps=6,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=48[p];[s1][p]paletteuse",
				"-loop",
				"0",
				gifPath,
			],
			{ stdio: "pipe" },
		)
		return true
	} catch {
		return false
	}
}

test("README theme toggle clip", async ({ page, context }) => {
	await mkdir(screenshotDir, { recursive: true })
	const listNotesMock: ReadmeListNotesMockState = {
		enabled: false,
		noteId: "",
		noteTitle: "",
	}
	await installReadmeViteApiBridge(page, context, () => listNotesMock)

	const { username, password } = readmeCredentials()
	const tokens = await readmeFetchTokens(context.request, username, password)

	await context.clearCookies()
	await page.goto("/login")
	await page.evaluate(() => {
		localStorage.clear()
		sessionStorage.clear()
	})
	await page.evaluate(({ access_token, refresh_token }) => {
		localStorage.setItem("access_token", access_token)
		localStorage.setItem("refresh_token", refresh_token)
	}, tokens)

	await page.goto("/notes")
	await expect(page.getByRole("tab", { name: "Active" })).toBeVisible({
		timeout: 30_000,
	})
	const toggle = page.getByRole("button", { name: "Toggle color mode" })
	await expect(toggle).toBeVisible()
	for (let i = 0; i < 2; i++) {
		await toggle.click()
		await page.waitForTimeout(260)
	}
	await page.waitForTimeout(120)

	const video = page.video()
	if (!video) {
		throw new Error("Expected page.video() when video mode is on")
	}
	const webmTmp = path.join(screenshotDir, "_readme-theme.webm")
	await page.close()
	await video.saveAs(webmTmp)
	const gifOut = path.join(screenshotDir, "theme-toggle.gif")
	tryWebmToGif(webmTmp, gifOut)
	await unlink(webmTmp).catch(() => {})
})
