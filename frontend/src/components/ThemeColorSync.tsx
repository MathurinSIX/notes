import { THEME_COLOR_DARK, THEME_COLOR_LIGHT } from "@/lib/themeChrome"
import { useTheme } from "next-themes"
import { useLayoutEffect } from "react"

const META_ID = "pwa-theme-color"

/** Keeps `<meta name="theme-color">` aligned with resolved light/dark (standalone / browser UI). */
export function ThemeColorSync() {
	const { resolvedTheme } = useTheme()

	useLayoutEffect(() => {
		if (!resolvedTheme) return
		const content =
			resolvedTheme === "dark" ? THEME_COLOR_DARK : THEME_COLOR_LIGHT
		let meta = document.getElementById(META_ID) as HTMLMetaElement | null
		if (!meta) {
			meta = document.createElement("meta")
			meta.id = META_ID
			meta.name = "theme-color"
			document.head.appendChild(meta)
		}
		meta.content = content
	}, [resolvedTheme])

	return null
}
