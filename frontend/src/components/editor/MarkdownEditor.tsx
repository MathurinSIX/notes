import { uploadPasteImage } from "@/api/files"
import { ApiError } from "@/client"
import { authMarkdownImageComponents } from "@/components/editor/MarkdownAuthImage"
import { getApiUrl } from "@/config/backendConfig"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import MDEditor from "@uiw/react-md-editor"
import "@uiw/react-md-editor/markdown-editor.css"
import { useTheme } from "next-themes"
import { MdAutorenew } from "react-icons/md"
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type ClipboardEvent,
	type CSSProperties,
} from "react"

/** Must stay in sync with backend `NOTE_PASTE_IMAGE_MAX_BYTES` default. */
const MAX_PASTE_IMAGE_BYTES = 25 * 1024 * 1024

function looksLikeImageFile(f: File): boolean {
	if (f.type.startsWith("image/")) return true
	if (f.name && /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(f.name)) return true
	return false
}

function firstImageFromClipboard(data: DataTransfer | null): File | null {
	if (!data) return null
	for (const item of data.items ?? []) {
		if (item.kind !== "file") continue
		const f = item.getAsFile()
		if (f && looksLikeImageFile(f)) return f
	}
	if (data.files?.length) {
		for (let i = 0; i < data.files.length; i++) {
			const f = data.files.item(i)
			if (f && looksLikeImageFile(f)) return f
		}
	}
	return null
}

function commitMarkdownInsert(
	ta: HTMLTextAreaElement,
	start: number,
	end: number,
	base: string,
	insert: string,
	onChange: (s: string) => void,
): void {
	const next = base.slice(0, start) + insert + base.slice(end)
	onChange(next)
	window.setTimeout(() => {
		ta.focus()
		const pos = start + insert.length
		ta.setSelectionRange(pos, pos)
	}, 0)
}

/** Wrap URL in angle brackets so query strings do not break markdown image syntax. */
function markdownImageFromUrl(url: string): string {
	return `![](<${url}>)`
}

function absolutePasteImageHref(path: string): string {
	const base =
		getApiUrl() ||
		(typeof window !== "undefined" ? window.location.origin : "")
	return new URL(path, base.endsWith("/") ? base : `${base}/`).href
}

function dataImageUrlFromHtmlClipboard(data: DataTransfer | null): string | null {
	const html = data?.getData("text/html")?.trim()
	if (!html) return null
	let doc: Document
	try {
		doc = new DOMParser().parseFromString(html, "text/html")
	} catch {
		return null
	}
	for (const img of doc.querySelectorAll("img[src]")) {
		const src = img.getAttribute("src")?.trim() ?? ""
		if (src.startsWith("data:image/")) return src
	}
	return null
}

async function dataImageUrlToFile(dataUrl: string): Promise<File> {
	const res = await fetch(dataUrl)
	if (!res.ok) throw new Error("Could not read clipboard image")
	const blob = await res.blob()
	const type =
		blob.type && blob.type.startsWith("image/") ? blob.type : "image/png"
	const sub = type.split("/")[1]?.split("+")[0] ?? "png"
	return new File([blob], `pasted.${sub}`, { type })
}

export type MarkdownEditorVariant = "chunk"

const heights: Record<MarkdownEditorVariant, CSSProperties["height"]> = {
	chunk: 300,
}

type MarkdownEditorProps = {
	value: string
	onChange: (value: string) => void
	variant: MarkdownEditorVariant
	id?: string
	preview?: "edit" | "live" | "preview"
	className?: string
	/** When true, the editor is read-only (e.g. while a form is submitting). */
	disabled?: boolean
	placeholder?: string
}

export function MarkdownEditor({
	value,
	onChange,
	variant,
	id,
	preview = "live",
	className,
	disabled = false,
	placeholder,
}: MarkdownEditorProps) {
	const { resolvedTheme } = useTheme()
	const colorMode: "light" | "dark" =
		resolvedTheme === "dark" ? "dark" : "light"

	const [imagePasteLoading, setImagePasteLoading] = useState(false)
	const mountedRef = useRef(true)
	useEffect(() => {
		mountedRef.current = true
		return () => {
			mountedRef.current = false
		}
	}, [])

	const uploadAndInsert = useCallback(
		async (
			ta: HTMLTextAreaElement,
			start: number,
			end: number,
			base: string,
			file: File,
			opts?: { skipLoading?: boolean },
		) => {
			const manageLoading = !opts?.skipLoading
			if (manageLoading && mountedRef.current) setImagePasteLoading(true)
			try {
				const { path } = await uploadPasteImage(file)
				if (!mountedRef.current) return
				const href = absolutePasteImageHref(path)
				commitMarkdownInsert(
					ta,
					start,
					end,
					base,
					markdownImageFromUrl(href),
					onChange,
				)
			} catch (err) {
				if (!mountedRef.current) return
				let msg = "Could not upload image."
				if (err instanceof ApiError) {
					if (err.status === 401) {
						msg = "Sign in to paste images into notes."
					} else if (err.status === 413) {
						msg = "Image too large for upload."
					} else if (err.status === 502) {
						msg = "Image storage is unavailable. Try again later."
					}
				}
				toast({
					variant: "destructive",
					title: "Upload failed",
					description: msg,
				})
			} finally {
				if (manageLoading && mountedRef.current) {
					setImagePasteLoading(false)
				}
			}
		},
		[onChange],
	)

	const onPasteCapture = useCallback(
		(e: ClipboardEvent<HTMLDivElement>) => {
			const t = e.target
			if (!(t instanceof HTMLTextAreaElement)) return
			if (!t.classList.contains("w-md-editor-text-input")) return

			const file = firstImageFromClipboard(e.clipboardData)
			if (file) {
				if (file.size > MAX_PASTE_IMAGE_BYTES) {
					e.preventDefault()
					e.stopPropagation()
					toast({
						variant: "destructive",
						title: "Image too large",
						description: `Pasted images must be under ${MAX_PASTE_IMAGE_BYTES / (1024 * 1024)} MB.`,
					})
					return
				}
				e.preventDefault()
				e.stopPropagation()
				const start = t.selectionStart
				const end = t.selectionEnd
				const base = t.value
				void uploadAndInsert(t, start, end, base, file)
				return
			}

			const fromHtml = dataImageUrlFromHtmlClipboard(e.clipboardData)
			if (fromHtml) {
				const approxBytes = Math.ceil((fromHtml.length * 3) / 4)
				if (approxBytes > MAX_PASTE_IMAGE_BYTES) {
					e.preventDefault()
					e.stopPropagation()
					toast({
						variant: "destructive",
						title: "Image too large",
						description: `Pasted images must be under ${MAX_PASTE_IMAGE_BYTES / (1024 * 1024)} MB.`,
					})
					return
				}
				e.preventDefault()
				e.stopPropagation()
				const start = t.selectionStart
				const end = t.selectionEnd
				const base = t.value
				void (async () => {
					if (mountedRef.current) setImagePasteLoading(true)
					try {
						const f = await dataImageUrlToFile(fromHtml)
						if (f.size > MAX_PASTE_IMAGE_BYTES) {
							toast({
								variant: "destructive",
								title: "Image too large",
								description: `Pasted images must be under ${MAX_PASTE_IMAGE_BYTES / (1024 * 1024)} MB.`,
							})
							return
						}
						await uploadAndInsert(t, start, end, base, f, {
							skipLoading: true,
						})
					} catch {
						if (!mountedRef.current) return
						toast({
							variant: "destructive",
							title: "Could not read image",
							description: "Try copying the image again.",
						})
					} finally {
						if (mountedRef.current) setImagePasteLoading(false)
					}
				})()
			}
		},
		[uploadAndInsert],
	)

	return (
		<div
			className={cn(
				"markdown-editor-shell relative overflow-hidden rounded-md border border-input bg-background text-foreground",
				"[&_.w-md-editor]:bg-transparent [&_.w-md-editor-toolbar]:border-border [&_.w-md-editor-toolbar]:bg-muted/40",
				"[&_.w-md-editor-content]:bg-background",
				disabled && "pointer-events-none opacity-60",
				className,
			)}
			onPasteCapture={disabled ? undefined : onPasteCapture}
			aria-busy={imagePasteLoading}
		>
			<MDEditor
				value={value}
				onChange={(v) => onChange(v ?? "")}
				height={heights[variant]}
				preview={preview}
				visibleDragbar={variant !== "chunk"}
				data-color-mode={colorMode}
				previewOptions={{ components: authMarkdownImageComponents }}
				textareaProps={{
					id,
					spellCheck: true,
					readOnly: disabled,
					...(placeholder ? { placeholder } : {}),
				}}
				enableScroll
			/>
			{imagePasteLoading ? (
				<div
					className="pointer-events-auto absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/75 text-muted-foreground backdrop-blur-[1px]"
					role="status"
					aria-live="polite"
					aria-label="Uploading pasted image"
				>
					<MdAutorenew
						className="h-8 w-8 animate-spin text-primary"
						aria-hidden
					/>
					<span className="text-sm font-medium text-foreground">
						Uploading image…
					</span>
				</div>
			) : null}
		</div>
	)
}
