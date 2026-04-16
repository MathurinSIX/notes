import type { CancelablePromise } from "./core/CancelablePromise"
import { OpenAPI } from "./core/OpenAPI"
import { request as __request } from "./core/request"

import type {
	ExampleWorkflowInput,
	RefreshTokenRequest,
	RunCreate,
	RunOut,
	RunUpdate,
	RunsOut,
	Token,
	UserCreate,
	UserOut,
	UserUpdate,
	UsersOut,
} from "./models"

export type LoginData = {
	RefreshToken: {
		requestBody: RefreshTokenRequest
	}
	AccessToken: {
		username: string
		password: string
	}
}

export type UserData = {
	ReadUserById: {
		id: string
	}
	UpdateUser: {
		id: string
		requestBody: UserUpdate
	}
	DeleteUser: {
		id: string
	}
	ListUsers: {
		limit?: number
		name?: Array<string> | null
		skip?: number
	}
	CreateUser: {
		requestBody: UserCreate
	}
}

export type RunData = {
	ReadRunById: {
		id: string
	}
	UpdateRun: {
		id: string
		requestBody: RunUpdate
	}
	DeleteRun: {
		id: string
	}
	DownloadExportedFileById: {
		id: string
	}
	ListRuns: {
		deleted?: Array<boolean> | null
		documentId?: Array<string> | null
		limit?: number
		name?: Array<string> | null
		skip?: number
		status?: Array<string> | null
		workflow?: Array<string> | null
	}
	CreateRun: {
		requestBody: RunCreate
	}
}

export type WorkflowData = {
	ExampleWorkflow: {
		requestBody: ExampleWorkflowInput
	}
}

export type UtilsData = {}

export class LoginService {
	/**
	 * Refresh Token
	 * Get a new access token and refresh token using a valid refresh token.
	 * @returns Token Successful Response
	 * @throws ApiError
	 */
	public static refreshToken(
		data: LoginData["RefreshToken"],
	): CancelablePromise<Token> {
		const { requestBody } = data
		return __request(OpenAPI, {
			method: "POST",
			url: "/login/refresh",
			body: requestBody,
			mediaType: "application/json",
			errors: {
				422: "Validation Error",
			},
		})
	}

	/**
	 * Login with email and password (OAuth2 password flow: form field ``username`` is email).
	 * @returns Token Successful Response
	 * @throws ApiError
	 */
	public static loginAccessToken(
		data: LoginData["AccessToken"],
	): CancelablePromise<Token> {
		const { username, password } = data
		const body = new URLSearchParams({
			username,
			password,
		})
		return __request(OpenAPI, {
			method: "POST",
			url: "/login/access-token",
			body,
			mediaType: "application/x-www-form-urlencoded",
			errors: {
				401: "Incorrect email or password",
				422: "Validation Error",
			},
		})
	}
}

export class UserService {
	/**
	 * Self
	 * Return current user information.
	 * @returns UserOut Successful Response
	 * @throws ApiError
	 */
	public static self(): CancelablePromise<UserOut> {
		return __request(OpenAPI, {
			method: "GET",
			url: "/users/self",
		})
	}

	/**
	 * Read User By Id
	 * Get a specific user by id.
	 * @returns UserOut Successful Response
	 * @throws ApiError
	 */
	public static readUserById(
		data: UserData["ReadUserById"],
	): CancelablePromise<UserOut> {
		const { id } = data
		return __request(OpenAPI, {
			method: "GET",
			url: "/users/{id}",
			path: {
				id,
			},
			errors: {
				422: "Validation Error",
			},
		})
	}

	/**
	 * Update User
	 * Update a user.
	 * @returns UserOut Successful Response
	 * @throws ApiError
	 */
	public static updateUser(
		data: UserData["UpdateUser"],
	): CancelablePromise<UserOut> {
		const { id, requestBody } = data
		return __request(OpenAPI, {
			method: "PATCH",
			url: "/users/{id}",
			path: {
				id,
			},
			body: requestBody,
			mediaType: "application/json",
			errors: {
				422: "Validation Error",
			},
		})
	}

	/**
	 * Delete User
	 * Delete a user.
	 * @returns unknown Successful Response
	 * @throws ApiError
	 */
	public static deleteUser(
		data: UserData["DeleteUser"],
	): CancelablePromise<unknown> {
		const { id } = data
		return __request(OpenAPI, {
			method: "DELETE",
			url: "/users/{id}",
			path: {
				id,
			},
			errors: {
				422: "Validation Error",
			},
		})
	}

	/**
	 * List Users
	 * Retrieve users.
	 * @returns UsersOut Successful Response
	 * @throws ApiError
	 */
	public static listUsers(
		data: UserData["ListUsers"] = {},
	): CancelablePromise<UsersOut> {
		const { name, skip = 0, limit = 100 } = data
		return __request(OpenAPI, {
			method: "GET",
			url: "/users/",
			query: {
				name,
				skip,
				limit,
			},
			errors: {
				422: "Validation Error",
			},
		})
	}

	/**
	 * Create User
	 * Create new user.
	 * @returns UserOut Successful Response
	 * @throws ApiError
	 */
	public static createUser(
		data: UserData["CreateUser"],
	): CancelablePromise<UserOut> {
		const { requestBody } = data
		return __request(OpenAPI, {
			method: "POST",
			url: "/users/",
			body: requestBody,
			mediaType: "application/json",
			errors: {
				422: "Validation Error",
			},
		})
	}
}

export class RunService {
	/**
	 * Read Run By Id
	 * Get a specific run by id.
	 * @returns RunOut Successful Response
	 * @throws ApiError
	 */
	public static readRunById(
		data: RunData["ReadRunById"],
	): CancelablePromise<RunOut> {
		const { id } = data
		return __request(OpenAPI, {
			method: "GET",
			url: "/run/{id}",
			path: {
				id,
			},
			errors: {
				422: "Validation Error",
			},
		})
	}

	/**
	 * Update Run
	 * Update a run.
	 * @returns RunOut Successful Response
	 * @throws ApiError
	 */
	public static updateRun(
		data: RunData["UpdateRun"],
	): CancelablePromise<RunOut> {
		const { id, requestBody } = data
		return __request(OpenAPI, {
			method: "PATCH",
			url: "/run/{id}",
			path: {
				id,
			},
			body: requestBody,
			mediaType: "application/json",
			errors: {
				422: "Validation Error",
			},
		})
	}

	/**
	 * Delete Run
	 * Delete a run.
	 * @returns unknown Successful Response
	 * @throws ApiError
	 */
	public static deleteRun(
		data: RunData["DeleteRun"],
	): CancelablePromise<unknown> {
		const { id } = data
		return __request(OpenAPI, {
			method: "DELETE",
			url: "/run/{id}",
			path: {
				id,
			},
			errors: {
				422: "Validation Error",
			},
		})
	}

	/**
	 * Download Exported File By Id
	 * Downloads the excel file that was exported using the export workflow
	 * @returns unknown Successful Response
	 * @throws ApiError
	 */
	public static downloadExportedFileById(
		data: RunData["DownloadExportedFileById"],
	): CancelablePromise<unknown> {
		const { id } = data
		return __request(OpenAPI, {
			method: "GET",
			url: "/run/download_exported_file/{id}",
			path: {
				id,
			},
			errors: {
				422: "Validation Error",
			},
		})
	}

	/**
	 * List Runs
	 * Retrieve runs.
	 * @returns RunsOut Successful Response
	 * @throws ApiError
	 */
	public static listRuns(
		data: RunData["ListRuns"] = {},
	): CancelablePromise<RunsOut> {
		const {
			documentId,
			workflow,
			status,
			deleted,
			name,
			skip = 0,
			limit = 100,
		} = data
		return __request(OpenAPI, {
			method: "GET",
			url: "/run/",
			query: {
				document_id: documentId,
				workflow,
				status,
				deleted,
				name,
				skip,
				limit,
			},
			errors: {
				422: "Validation Error",
			},
		})
	}

	/**
	 * Create Run
	 * Create new run.
	 * @returns RunOut Successful Response
	 * @throws ApiError
	 */
	public static createRun(
		data: RunData["CreateRun"],
	): CancelablePromise<RunOut> {
		const { requestBody } = data
		return __request(OpenAPI, {
			method: "POST",
			url: "/run/",
			body: requestBody,
			mediaType: "application/json",
			errors: {
				422: "Validation Error",
			},
		})
	}
}

export class WorkflowService {
	/**
	 * Example Workflow
	 * Run an example workflow.
	 * @returns unknown Successful Response
	 * @throws ApiError
	 */
	public static exampleWorkflow(
		data: WorkflowData["ExampleWorkflow"],
	): CancelablePromise<unknown> {
		const { requestBody } = data
		return __request(OpenAPI, {
			method: "POST",
			url: "/workflow/example-workflow",
			body: requestBody,
			mediaType: "application/json",
			errors: {
				422: "Validation Error",
			},
		})
	}
}

export class UtilsService {
	/**
	 * Health Check
	 * @returns boolean Successful Response
	 * @throws ApiError
	 */
	public static healthCheck(): CancelablePromise<boolean> {
		return __request(OpenAPI, {
			method: "GET",
			url: "/health",
		})
	}

	/**
	 * Liveness Check
	 * @returns boolean Successful Response
	 * @throws ApiError
	 */
	public static livenessCheck(): CancelablePromise<boolean> {
		return __request(OpenAPI, {
			method: "GET",
			url: "/live",
		})
	}
}
