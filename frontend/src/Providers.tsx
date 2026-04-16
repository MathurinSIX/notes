import { OpenAPI } from "@/client"
import { Toaster } from "@/components/ui/toaster"
import { setup401Interceptor } from "@/config/apiSetup"
import { getApiUrl } from "@/config/backendConfig"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import moment from "moment-timezone"
import { ThemeProvider } from "next-themes"
import { useState } from "react"

function configureOpenApiClient() {
	OpenAPI.BASE = getApiUrl()
	OpenAPI.TOKEN = async () => localStorage.getItem("access_token") || ""
	setup401Interceptor()
}

configureOpenApiClient()

moment.tz.setDefault("Etc/UTC")

export function Providers({ children }: { children: React.ReactNode }) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 60 * 1000,
					},
				},
			}),
	)

	return (
		<ThemeProvider attribute="class" disableTransitionOnChange>
			<QueryClientProvider client={queryClient}>
				{children}
				<Toaster />
				{import.meta.env.DEV && (
					<ReactQueryDevtools initialIsOpen={false} />
				)}
			</QueryClientProvider>
		</ThemeProvider>
	)
}
