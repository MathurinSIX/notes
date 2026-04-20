import Breadcrumb from "@/components/Breadcrumb"
import { ProjectLogo } from "@/components/ProjectLogo"
import SettingMenu from "@/components/SettingMenu"
import { WorkflowTopBarIndicator } from "@/components/WorkflowTopBarIndicator"
import { useColorModeValue } from "@/components/ui/color-mode"
import { Link } from "@tanstack/react-router"
import { useEffect } from "react"

interface HomeLayoutProps {
	children: React.ReactNode
}

export function HomeLayout({ children }: HomeLayoutProps) {
	const borderColor = useColorModeValue("border-gray-200", "border-gray-800")

	useEffect(() => {
		const returnTo = sessionStorage.getItem("return_to")
		if (returnTo) {
			sessionStorage.removeItem("return_to")
			window.location.pathname = returnTo
		}
	}, [])

	return (
		<div className="flex flex-col mb-2">
			<header
				className={`sticky top-0 z-50 flex h-16 items-center border-b ${borderColor} px-6 backdrop-blur-md backdrop-saturate-150`}
			>
				<Link
					to="/"
					className="flex shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				>
					<ProjectLogo />
				</Link>
				<WorkflowTopBarIndicator />
				<div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-3 md:gap-4">
					<Link
						to="/notes"
						className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
					>
						Notes
					</Link>
					<SettingMenu />
				</div>
			</header>
			<Breadcrumb />
			<main className="max-w-7xl mx-auto w-full">{children}</main>
		</div>
	)
}
