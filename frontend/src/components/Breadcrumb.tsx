import { Link, useRouterState } from "@tanstack/react-router"

interface BreadcrumbItem {
	label: string
	href: string
}

export default function Breadcrumb() {
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	})

	// Don't show breadcrumb on login or home page
	if (pathname === "/login" || pathname === "/") {
		return null
	}

	const segments = pathname.split("/").filter(Boolean)
	const items: BreadcrumbItem[] = [
		{ label: "Home", href: "/" },
		...segments.map((segment, index) => {
			const href = `/${segments.slice(0, index + 1).join("/")}`
			const label = segment
				.split("-")
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join(" ")
			return { label, href }
		}),
	]

	return (
		<nav
			className="flex min-h-[44px] items-center gap-2 border-b border-border bg-background px-6 py-3 text-sm"
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
									className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
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
											className="text-muted-foreground hover:text-foreground transition-colors"
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
