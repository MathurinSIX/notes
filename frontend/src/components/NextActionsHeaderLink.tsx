import { listNotes } from "@/api/notes"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "@/lib/utils"

export const NOTES_NEXT_ACTIONS_HEADER_QUERY_KEY = [
	"notesNextActionsHeader",
] as const

export function NextActionsHeaderLink() {
	const { data: nextActions = [] } = useQuery({
		queryKey: NOTES_NEXT_ACTIONS_HEADER_QUERY_KEY,
		queryFn: async () => {
			const res = await listNotes({ limit: 1, skip: 0 })
			return res.next_actions ?? []
		},
		staleTime: 60_000,
		refetchOnWindowFocus: true,
		enabled:
			typeof window !== "undefined" &&
			!!localStorage.getItem("access_token"),
		retry: false,
	})

	const n = nextActions.length

	return (
		<Link
			to="/notes/actions"
			className={cn(
				"inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary",
				n > 0 && "text-teal-800 dark:text-teal-200",
			)}
		>
			Actions
			{n > 0 ? (
				<span
					className="rounded-full bg-teal-500/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-teal-900 dark:bg-teal-500/20 dark:text-teal-100"
					aria-label={`${n} open follow-ups`}
				>
					{n}
				</span>
			) : null}
		</Link>
	)
}
