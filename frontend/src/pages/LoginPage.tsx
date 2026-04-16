import { ApiError } from "@/client"
import { LoginService } from "@/client/services"
import { ProjectLogo } from "@/components/ProjectLogo"
import { Button } from "@/components/ui/button"
import { ensureLoggedIn, setTokens } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"

export function LoginPage() {
	const [mounted, setMounted] = useState(false)
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [submitting, setSubmitting] = useState(false)
	const navigate = useNavigate()

	useEffect(() => {
		setMounted(true)
		ensureLoggedIn().then((loggedIn) => {
			if (loggedIn) {
				navigate({ to: "/" })
			}
		})
	}, [navigate])

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault()
		setError(null)
		setSubmitting(true)
		try {
			const token = await LoginService.loginAccessToken({
				username: email.trim(),
				password,
			})
			setTokens(token.access_token, token.refresh_token)
			navigate({ to: "/" })
		} catch (e) {
			if (e instanceof ApiError && e.status === 401) {
				setError("Incorrect email or password.")
			} else if (e instanceof ApiError) {
				setError(
					`Sign-in failed (HTTP ${e.status}). Check that the backend is running and reachable.`,
				)
			} else {
				setError("Sign-in failed. Check your connection and try again.")
			}
		} finally {
			setSubmitting(false)
		}
	}

	if (!mounted) {
		return null
	}

	const inputClassName = cn(
		"flex h-10 w-[300px] rounded-md border border-input bg-background px-3 py-2 text-sm",
		"ring-offset-background placeholder:text-muted-foreground",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
	)

	return (
		<div className="flex h-screen">
			<div className="hidden w-1/2 items-center justify-center p-3 md:flex">
				<ProjectLogo className="text-2xl md:text-3xl" />
			</div>

			<div className="flex w-full flex-col items-center justify-center p-3 md:w-1/2">
				<form
					onSubmit={onSubmit}
					className="flex w-full max-w-[320px] flex-col items-center gap-4"
				>
					<div className="mb-2 md:hidden">
						<ProjectLogo className="text-2xl md:text-3xl" />
					</div>
					<input
						type="email"
						name="email"
						autoComplete="email"
						placeholder="Email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className={inputClassName}
						required
					/>
					<input
						type="password"
						name="password"
						autoComplete="current-password"
						placeholder="Password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className={inputClassName}
						required
					/>
					{error ? (
						<p className="w-[300px] text-center text-sm text-destructive">
							{error}
						</p>
					) : null}
					<Button
						type="submit"
						variant="solid"
						className="w-[300px]"
						disabled={submitting}
					>
						{submitting ? "Signing in..." : "Sign in"}
					</Button>
				</form>
			</div>
		</div>
	)
}
