import { authMarkdownImageComponents } from "@/components/editor/MarkdownAuthImage"
import { cn } from "@/lib/utils"
import MDEditor from "@uiw/react-md-editor"
import "@uiw/react-md-editor/markdown-editor.css"
import { useTheme } from "next-themes"

type MarkdownPreviewProps = {
	source: string
	className?: string
	/** Bordered panel (e.g. editors). Reader views use framed={false}. */
	framed?: boolean
}

export function MarkdownPreview({
	source,
	className,
	framed = true,
}: MarkdownPreviewProps) {
	const { resolvedTheme } = useTheme()
	const colorMode: "light" | "dark" =
		resolvedTheme === "dark" ? "dark" : "light"

	return (
		<div
			className={cn(
				"text-foreground [&_.wmde-markdown]:bg-transparent [&_.wmde-markdown-var]:bg-transparent",
				framed
					? "rounded-md border border-border bg-muted/20 px-4 py-3"
					: "px-0 py-1 [&_.wmde-markdown]:text-[1.0625rem] [&_.wmde-markdown]:leading-relaxed [&_h1]:mb-4 [&_h1]:mt-8 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:first:mt-0 [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:first:mt-0 [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_p]:mb-4 [&_p]:last:mb-0 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1 [&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-muted/80 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted/40 [&_pre]:p-4 [&_hr]:my-10 [&_hr]:border-border",
				className,
			)}
			data-color-mode={colorMode}
		>
			<MDEditor.Markdown
				source={source}
				components={authMarkdownImageComponents}
			/>
		</div>
	)
}
