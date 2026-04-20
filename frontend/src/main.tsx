import { registerSW } from "virtual:pwa-register"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Providers } from "./Providers"
import "./index.css"
import { routeTree } from "./routeTree.gen"

registerSW({ immediate: true })

const router = createRouter({
	routeTree,
	defaultPreload: "intent",
	scrollRestoration: true,
})

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router
	}
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<Providers>
			<RouterProvider router={router} />
		</Providers>
	</StrictMode>,
)
