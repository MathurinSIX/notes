import { Slot } from "@radix-ui/react-slot"
import { type VariantProps, cva } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
	"inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				default:
					"bg-primary text-primary-foreground hover:bg-primary/90",
				destructive:
					"bg-destructive text-destructive-foreground hover:bg-destructive/90",
				outline:
					"border border-input bg-background hover:bg-accent hover:text-accent-foreground",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-secondary/80",
				ghost: "hover:bg-accent hover:text-accent-foreground",
				link: "text-primary underline-offset-4 hover:underline",
				solid: "bg-primary text-primary-foreground hover:bg-primary/90",
				brand: "border-0 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-400 text-neutral-950 shadow-sm hover:brightness-105 hover:shadow-md dark:from-yellow-300 dark:via-amber-300 dark:to-yellow-200 dark:text-neutral-950",
				updateNotes:
					"border-0 bg-gradient-to-r from-primary via-chart-2 to-chart-3 text-primary-foreground shadow-sm [text-shadow:0_1px_0_rgb(0_0_0_/_0.12)] hover:brightness-110 hover:shadow-md active:brightness-95 dark:via-chart-4 dark:to-chart-5 dark:[text-shadow:0_1px_1px_rgb(0_0_0_/_0.35)]",
			},
			size: {
				default: "h-10 px-4 py-2",
				sm: "h-9 rounded-md px-3",
				lg: "h-11 rounded-md px-8",
				hero: "h-12 rounded-lg px-8 text-base font-semibold md:h-14 md:px-10 md:text-lg",
				icon: "h-10 w-10",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
)

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button"
		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...props}
			/>
		)
	},
)
Button.displayName = "Button"

export { Button, buttonVariants }
