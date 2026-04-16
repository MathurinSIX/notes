import { useTheme } from "next-themes"
import * as React from "react"
import { LuMoon, LuSun } from "react-icons/lu"
import { Button } from "./button"

export function useColorMode() {
	const { resolvedTheme, setTheme } = useTheme()
	const toggleColorMode = () => {
		setTheme(resolvedTheme === "light" ? "dark" : "light")
	}
	return {
		colorMode: resolvedTheme,
		setColorMode: setTheme,
		toggleColorMode,
	}
}

export function useColorModeValue<T>(light: T, dark: T) {
	const { colorMode } = useColorMode()
	return colorMode === "light" ? light : dark
}

export function ColorModeIcon() {
	const { colorMode } = useColorMode()
	return colorMode === "light" ? <LuSun /> : <LuMoon />
}

interface ColorModeButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const ColorModeButton = React.forwardRef<
	HTMLButtonElement,
	ColorModeButtonProps
>(function ColorModeButton(props, ref) {
	const { toggleColorMode } = useColorMode()
	return (
		<Button
			onClick={toggleColorMode}
			variant="ghost"
			size="icon"
			aria-label="Toggle color mode"
			ref={ref}
			{...props}
		>
			<ColorModeIcon />
		</Button>
	)
})
