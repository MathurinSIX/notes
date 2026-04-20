import { cn } from "@/lib/utils"
import MDEditor from "@uiw/react-md-editor"
import "@uiw/react-md-editor/markdown-editor.css"
import { useTheme } from "next-themes"
import type { CSSProperties } from "react"

export type MarkdownEditorVariant = "chunk"

const heights: Record<MarkdownEditorVariant, CSSProperties["height"]> = {
	chunk: 300,
}

type MarkdownEditorProps = {
	value: string
	onChange: (value: string) => void
	variant: MarkdownEditorVariant
	/** Associates the underlying textarea with a `<label htmlFor>`. */
	id?: string
	preview?: "edit" | "live" | "preview"
	className?: string
}

export function MarkdownEditor({
	value,
	onChange,
	variant,
	id,
	preview = "live",
	className,
}: MarkdownEditorProps) {
	const { resolvedTheme } = useTheme()
	const colorMode: "light" | "dark" =
		resolvedTheme === "dark" ? "dark" : "light"

	return (
		<div
			className={cn(
				"markdown-editor-shell overflow-hidden rounded-md border border-input bg-background text-foreground",
				"[&_.w-md-editor]:bg-transparent [&_.w-md-editor-toolbar]:border-border [&_.w-md-editor-toolbar]:bg-muted/40",
				"[&_.w-md-editor-content]:bg-background",
				className,
			)}
		>
			<MDEditor
				value={value}
				onChange={(v) => onChange(v ?? "")}
				height={heights[variant]}
				preview={preview}
				visibleDragbar={variant !== "chunk"}
				data-color-mode={colorMode}
				textareaProps={{ id, spellCheck: true }}
				enableScroll
			/>
		</div>
	)
}
