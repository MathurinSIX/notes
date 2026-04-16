export type ExampleWorkflowInput = {
	text: string
}

export type HTTPValidationError = {
	detail?: Array<ValidationError>
}

export type RefreshTokenRequest = {
	refresh_token: string
}

export type RunCreate = {
	id?: string | null
	name?: string | null
	workflow: string
	status: WorkflowStatus
	pid?: number | null
	params?: Record<string, unknown> | null
	output?: Record<string, unknown> | null
	total_steps?: number | null
	creator_id: string
	pod_name: string
}

export type RunOut = {
	id: string
	name: string
	workflow: string
	status: WorkflowStatus
	created_by: Users
	params?: Record<string, unknown> | null
	output?: Record<string, unknown> | null
	updated_ts: string
	created_ts: string
}

export type RunUpdate = {
	status: WorkflowStatus
	duration: number
	total_steps?: number | null
	output?: Record<string, unknown> | null
}

export type Runs = {
	id: string
	name: string
	workflow: string
	status: WorkflowStatus
	created_by: Users
	params?: Record<string, unknown> | null
	output?: Record<string, unknown> | null
	updated_ts: string
	created_ts: string
}

export type RunsOut = {
	data: Array<Runs>
	count: number
}

export type Token = {
	access_token: string
	refresh_token: string
	token_type?: string
}

export type UserCreate = {
	email: string
	password?: string | null
	full_name?: string | null
	is_active?: boolean
	is_superuser?: boolean
}

export type UserOut = {
	id: string
	full_name: string | null
	is_superuser: boolean
	created_ts: string
}

export type UserUpdate = {
	email?: string | null
	full_name?: string | null
}

export type Users = {
	id: string
	full_name: string | null
}

export type UsersOut = {
	data: Array<Users>
	count: number
}

export type ValidationError = {
	loc: Array<string | number>
	msg: string
	type: string
}

export type WorkflowStatus =
	| "pending"
	| "skipped"
	| "started"
	| "failed"
	| "succeeded"
	| "stopped"
