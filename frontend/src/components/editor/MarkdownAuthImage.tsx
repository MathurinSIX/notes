import { getApiUrl } from "@/config/backendConfig"
import type { Components } from "react-markdown"
import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react"

function absolutifyIfRelative(src: string): string {
	if (src.startsWith("http://") || src.startsWith("https://")) return src
	const base = getApiUrl() || (typeof window !== "undefined" ? window.location.origin : "")
	return new URL(src, base.endsWith("/") ? base : `${base}/`).href
}

function isPasteImageApiUrl(url: string): boolean {
	try {
		const u = new URL(url)
		return u.pathname.startsWith("/files/paste-images/")
	} catch {
		return false
	}
}

/**
 * Renders markdown images. Paths under `/files/paste-images/` are loaded with the API access token
 * so they work without public bucket URLs.
 */
export function AuthMarkdownImg({
	src,
	alt,
	className,
	...rest
}: ImgHTMLAttributes<HTMLImageElement>) {
	const [blobUrl, setBlobUrl] = useState<string | null>(null)
	const [failed, setFailed] = useState(false)
	const objectUrlRef = useRef<string | null>(null)

	useEffect(() => {
		if (!src) return
		const absolute = absolutifyIfRelative(src)
		if (!isPasteImageApiUrl(absolute)) {
			setBlobUrl(null)
			setFailed(false)
			return
		}
		const ac = new AbortController()
		;(async () => {
			try {
				const token = localStorage.getItem("access_token")
				const res = await fetch(absolute, {
					signal: ac.signal,
					headers: token ? { Authorization: `Bearer ${token}` } : {},
				})
				if (!res.ok) throw new Error(String(res.status))
				const blob = await res.blob()
				const u = URL.createObjectURL(blob)
				if (ac.signal.aborted) return
				if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
				objectUrlRef.current = u
				setBlobUrl(u)
				setFailed(false)
			} catch {
				if (!ac.signal.aborted) {
					setFailed(true)
					setBlobUrl(null)
				}
			}
		})()
		return () => {
			ac.abort()
			if (objectUrlRef.current) {
				URL.revokeObjectURL(objectUrlRef.current)
				objectUrlRef.current = null
			}
		}
	}, [src])

	if (!src) return null

	if (!isPasteImageApiUrl(absolutifyIfRelative(src))) {
		return <img src={src} alt={alt ?? ""} className={className} {...rest} />
	}

	if (failed) {
		return (
			<span className="text-sm text-muted-foreground">
				[Image could not be loaded]
			</span>
		)
	}

	if (!blobUrl) {
		return (
			<span
				className="inline-block h-24 min-w-[10rem] animate-pulse rounded bg-muted"
				aria-hidden
			/>
		)
	}

	return <img src={blobUrl} alt={alt ?? ""} className={className} {...rest} />
}

export const authMarkdownImageComponents: Partial<Components> = {
	img: AuthMarkdownImg,
}
