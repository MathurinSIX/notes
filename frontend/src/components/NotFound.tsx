import { Button } from "@/components/ui/button"
import { Link } from "@tanstack/react-router"

export default function NotFound() {
	return (
		<div className="container mx-auto mt-[20vh] flex max-w-sm flex-col items-center justify-center text-center">
			<h1 className="mb-4 text-8xl font-bold text-primary leading-none">
				404
			</h1>
			<p className="text-base">Oops!</p>
			<p className="text-base">Page not found.</p>
			<Link to="/">
				<Button
					variant="outline"
					className="mt-4 border-primary text-primary"
				>
					Go back
				</Button>
			</Link>
		</div>
	)
}
