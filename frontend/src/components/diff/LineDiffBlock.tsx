import { clsx } from "clsx"
import { diffLines } from "diff"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"

const UNCHANGED_CONTEXT = 3

/** Row count above the compact preview: offer “Show full section”. */
const MANY_LINES_THRESHOLD = 28

type DiffRow = { text: string; kind: "add" | "del" | "ctx" }

function splitPartLines(value: string): string[] {
	if (!value) return []
	const raw = value.split("\n")
	if (value.endsWith("\n") && raw.length > 0) {
		raw.pop()
	}
	return raw
}

function collapseMiddle(lines: string[]): {
	lines: string[]
	didCollapse: boolean
} {
	const cap = UNCHANGED_CONTEXT * 2 + 1
	if (lines.length <= cap) return { lines, didCollapse: false }
	const omitted = lines.length - UNCHANGED_CONTEXT * 2
	return {
		lines: [
			...lines.slice(0, UNCHANGED_CONTEXT),
			`… (${omitted} unchanged line${omitted === 1 ? "" : "s"})`,
			...lines.slice(-UNCHANGED_CONTEXT),
		],
		didCollapse: true,
	}
}

function buildDiffRows(
	before: string,
	after: string,
	collapseUnchanged: boolean,
): { rows: DiffRow[]; hasCollapsedUnchanged: boolean } {
	const parts = diffLines(before, after, { newlineIsToken: false })
	const rows: DiffRow[] = []
	let hasCollapsedUnchanged = false

	for (const part of parts) {
		const lines = splitPartLines(part.value)
		let processed: string[]
		if (part.added || part.removed) {
			processed = lines
		} else if (collapseUnchanged) {
			const { lines: collapsedLines, didCollapse } = collapseMiddle(lines)
			if (didCollapse) hasCollapsedUnchanged = true
			processed = collapsedLines
		} else {
			processed = lines
		}
		for (const line of processed) {
			if (part.added) rows.push({ text: line, kind: "add" })
			else if (part.removed) rows.push({ text: line, kind: "del" })
			else rows.push({ text: line, kind: "ctx" })
		}
	}

	return { rows, hasCollapsedUnchanged }
}

type LineDiffBlockProps = {
	before: string
	after: string
	className?: string
}

/**
 * Git-style line diff (green additions, red removals) for plain text / markdown source.
 */
export function LineDiffBlock({
	before,
	after,
	className,
}: LineDiffBlockProps) {
	const [fullSectionOpen, setFullSectionOpen] = useState(false)

	useEffect(() => {
		setFullSectionOpen(false)
	}, [before, after])

	const collapsedPreview = useMemo(
		() => buildDiffRows(before, after, true),
		[before, after],
	)
	const fullRows = useMemo(
		() => buildDiffRows(before, after, false),
		[before, after],
	)

	const rows = fullSectionOpen ? fullRows.rows : collapsedPreview.rows
	const showFullSectionToggle =
		collapsedPreview.hasCollapsedUnchanged ||
		collapsedPreview.rows.length > MANY_LINES_THRESHOLD

	const onlyCtx = rows.length > 0 && rows.every((r) => r.kind === "ctx")
	const identical = before === after

	if (rows.length === 0 || (onlyCtx && identical)) {
		return (
			<p
				className={clsx(
					"rounded-md border border-border bg-muted/20 px-3 py-2 font-mono text-xs text-muted-foreground",
					className,
				)}
			>
				No text changes.
			</p>
		)
	}

	return (
		<div className={clsx("space-y-1.5", className)}>
			<div
				className={clsx(
					"overflow-y-auto overflow-x-auto rounded-md border border-border font-mono text-xs leading-relaxed",
					fullSectionOpen
						? "max-h-[min(75vh,36rem)]"
						: "max-h-56",
				)}
				role="region"
				aria-label="Text diff"
			>
				{rows.map((row, i) => (
					<div
						key={`${row.kind}-${i}-${row.text.slice(0, 24)}`}
						className={clsx(
							"whitespace-pre-wrap break-words border-l-2 pl-2 pr-2 py-0.5",
							row.kind === "add" &&
								"border-emerald-600 bg-emerald-500/15 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-50",
							row.kind === "del" &&
								"border-rose-600 bg-rose-500/15 text-rose-950 dark:border-rose-500 dark:bg-rose-500/10 dark:text-rose-50",
							row.kind === "ctx" &&
								"border-transparent bg-muted/25 text-foreground/80",
						)}
					>
						<span className="select-none text-muted-foreground/70">
							{row.kind === "add"
								? "+"
								: row.kind === "del"
								  ? "−"
								  : " "}
						</span>
						{row.text.length === 0 ? "\u00a0" : row.text}
					</div>
				))}
			</div>
			{showFullSectionToggle ? (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
					onClick={() => setFullSectionOpen((o) => !o)}
				>
					{fullSectionOpen ? "Show compact preview" : "Show full section"}
				</Button>
			) : null}
		</div>
	)
}
