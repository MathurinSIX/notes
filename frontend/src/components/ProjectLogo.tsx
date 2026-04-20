import { cn } from "@/lib/utils"

type ProjectLogoProps = {
	className?: string
}

export function ProjectLogo({ className }: ProjectLogoProps) {
	return (
		<span
			className={cn(
				"inline-block bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-400 bg-clip-text font-semibold text-lg tracking-tight text-transparent dark:from-yellow-300 dark:via-amber-300 dark:to-yellow-200",
				className,
			)}
		>
			Notes
		</span>
	)
}
