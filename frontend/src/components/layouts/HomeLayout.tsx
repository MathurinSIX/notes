import Breadcrumb from "@/components/Breadcrumb"
import { ProjectLogo } from "@/components/ProjectLogo"
import SettingMenu from "@/components/SettingMenu"
import { useColorModeValue } from "@/components/ui/color-mode"
import { useEffect } from "react"
import { Link } from "@tanstack/react-router"

interface HomeLayoutProps {
	children: React.ReactNode
}

export function HomeLayout({ children }: HomeLayoutProps) {
	useEffect(() => {
		const returnTo = sessionStorage.getItem("return_to")
		if (returnTo) {
			sessionStorage.removeItem("return_to")
			window.location.pathname = returnTo
		}
	}, [])

	const borderColor = useColorModeValue("border-gray-200", "border-gray-800")

	return (
		<div className="flex flex-col mb-2">
			<header
				className={`sticky top-0 z-50 flex h-16 items-center border-b ${borderColor} px-6 backdrop-blur-md backdrop-saturate-150`}
			>
				<Link
					to="/"
					className="flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				>
					<ProjectLogo />
				</Link>
				<div className="ml-auto flex items-center gap-4">
					<SettingMenu />
				</div>
			</header>
			<Breadcrumb />
			<main className="max-w-7xl mx-auto w-full">{children}</main>
		</div>
	)
}
