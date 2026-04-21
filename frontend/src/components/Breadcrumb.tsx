import { Link, useRouterState } from "@tanstack/react-router"

interface BreadcrumbItem {
	label: string
	href: string
}

export default function Breadcrumb() {
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	})

	// Don't show breadcrumb on login or bare root (redirects to /notes)
	if (pathname === "/login" || pathname === "/") {
		return null
	}

	const segments = pathname.split("/").filter(Boolean)
	const uuidLike =
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

	const items: BreadcrumbItem[] = [
		{ label: "Home", href: "/" },
		...segments.map((segment, index) => {
			const href = `/${segments.slice(0, index + 1).join("/")}`
			const prev = index > 0 ? segments[index - 1] : ""
			const label =
				prev === "notes" && uuidLike.test(segment)
					? "Note"
					: segment
							.split("-")
							.map(
								(word) =>
									word.charAt(0).toUpperCase() +
									word.slice(1),
							)
							.join(" ")
			return { label, href }
		}),
	]

	return (
		<nav
			className="flex min-h-[44px] items-center gap-2 border-b border-border bg-gradient-to-r from-background/90 via-primary/[0.04] to-background/90 px-6 py-3 text-sm dark:via-chart-3/[0.08]"
			aria-label="Breadcrumb"
		>
			<ol className="flex items-center gap-2">
				{items.map((item, index) => {
					const isLast = index === items.length - 1
					return (
						<li
							key={`${item.href}-${index}`}
							className="flex items-center gap-2"
						>
							{index === 0 ? (
								<Link
									to={item.href}
									className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-primary"
								>
									<span>Home</span>
								</Link>
							) : (
								<>
									<span className="text-muted-foreground">
										/
									</span>
									{isLast ? (
										<span className="text-foreground font-medium">
											{item.label}
										</span>
									) : (
										<Link
											to={item.href}
											className="text-muted-foreground transition-colors hover:text-primary"
										>
											{item.label}
										</Link>
									)}
								</>
							)}
						</li>
					)
				})}
			</ol>
		</nav>
	)
}
