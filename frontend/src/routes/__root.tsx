import NotFound from "@/components/NotFound"
import { Outlet, createRootRoute } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"

export const Route = createRootRoute({
	component: RootLayout,
	notFoundComponent: NotFound,
})

function RootLayout() {
	return (
		<>
			<Outlet />
			{import.meta.env.DEV && (
				<TanStackRouterDevtools position="bottom-right" />
			)}
		</>
	)
}
