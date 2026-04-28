import { cn } from "@/lib/utils"

type ProjectLogoProps = {
	className?: string
}

export function ProjectLogo({ className }: ProjectLogoProps) {
	return (
		<span
			className={cn(
				"inline-block bg-gradient-to-br from-[#1e63eb] to-[#7c3aed] bg-clip-text font-semibold text-lg tracking-tight text-transparent",
				className,
			)}
		>
			Notes
		</span>
	)
}
