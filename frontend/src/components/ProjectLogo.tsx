import { cn } from "@/lib/utils"

type ProjectLogoProps = {
	className?: string
}

export function ProjectLogo({ className }: ProjectLogoProps) {
	return (
		<span
			className={cn(
				"inline-block bg-gradient-to-r from-violet-600 via-fuchsia-500 to-sky-500 bg-clip-text font-bold text-xl tracking-tight text-transparent dark:from-violet-400 dark:via-fuchsia-400 dark:to-sky-400",
				className,
			)}
		>
			My project
		</span>
	)
}
