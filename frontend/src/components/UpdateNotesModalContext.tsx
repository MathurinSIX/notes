import { createContext, useContext } from "react"

export const OpenUpdateNotesModalContext = createContext<(() => void) | null>(
	null,
)

export function useOpenUpdateNotesModal(): (() => void) | null {
	return useContext(OpenUpdateNotesModalContext)
}
