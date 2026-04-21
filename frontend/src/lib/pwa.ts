/** True when the app runs as an installed PWA (home screen / standalone). */
export function isPwaStandalone(): boolean {
	if (typeof window === "undefined") return false
	if (window.matchMedia("(display-mode: standalone)").matches) return true
	return (
		"standalone" in window.navigator &&
		(window.navigator as Navigator & { standalone?: boolean }).standalone ===
			true
	)
}
