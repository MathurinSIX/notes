import { Button } from "@/components/ui/button"
import { useColorMode } from "@/components/ui/color-mode"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { logout } from "@/hooks/useAuth"
import { MdDarkMode, MdLightMode, MdLogout, MdSettings } from "react-icons/md"

export default function SettingMenu() {
	const { toggleColorMode, colorMode } = useColorMode()

	const handleLogout = async () => {
		logout()
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" aria-label="Settings">
					<MdSettings className="h-[18px] w-[18px]" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuItem onClick={toggleColorMode}>
					{colorMode === "light" ? (
						<MdDarkMode className="mr-2 h-[18px] w-[18px]" />
					) : (
						<MdLightMode className="mr-2 h-[18px] w-[18px]" />
					)}
					{colorMode === "light" ? "Dark mode" : "Light mode"}
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={handleLogout}
					className="text-destructive focus:text-destructive font-bold"
				>
					<MdLogout className="mr-2 h-[18px] w-[18px]" />
					Log out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
