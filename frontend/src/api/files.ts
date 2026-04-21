import { OpenAPI } from "@/client"
import { request } from "@/client/core/request"

export type PasteImageResponse = {
	id: string
	/** Path only, e.g. `/files/paste-images/{id}` — resolve with API base for display. */
	path: string
}

/** Upload a pasted image to object storage; returns a URL suitable for markdown `![]()`. */
export async function uploadPasteImage(file: File): Promise<PasteImageResponse> {
	return request<PasteImageResponse>(OpenAPI, {
		method: "POST",
		url: "/files/paste-image",
		formData: { file },
		errors: {
			400: "Bad Request",
			401: "Unauthorized",
			413: "Payload Too Large",
			422: "Validation Error",
			502: "Bad Gateway",
		},
	}) as Promise<PasteImageResponse>
}
