import NotFound from "@/components/NotFound"
import { Outlet, createRootRoute } from "@tanstack/react-router"

export const Route = createRootRoute({
	component: RootLayout,
	notFoundComponent: NotFound,
})

function RootLayout() {
	return <Outlet />
}
