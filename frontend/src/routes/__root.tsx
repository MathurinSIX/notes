import { createRootRoute, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import NotFound from "@/components/NotFound"

export const Route = createRootRoute({
	component: RootLayout,
	notFoundComponent: NotFound,
})

function RootLayout() {
	return (
		<>
			<Outlet />
			{import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
		</>
	)
}
