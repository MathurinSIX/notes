export const $ExampleWorkflowInput = {
	properties: {
		text: {
			type: "string",
			isRequired: true,
		},
	},
} as const

export const $HTTPValidationError = {
	properties: {
		detail: {
			type: "array",
			contains: {
				type: "ValidationError",
			},
		},
	},
} as const

export const $RefreshTokenRequest = {
	properties: {
		refresh_token: {
			type: "string",
			isRequired: true,
		},
	},
} as const

export const $RunCreate = {
	properties: {
		id: {
			type: "any-of",
			contains: [
				{
					type: "string",
					format: "uuid",
				},
				{
					type: "null",
				},
			],
		},
		name: {
			type: "any-of",
			contains: [
				{
					type: "string",
				},
				{
					type: "null",
				},
			],
		},
		workflow: {
			type: "string",
			isRequired: true,
		},
		status: {
			type: "WorkflowStatus",
			isRequired: true,
		},
		pid: {
			type: "any-of",
			contains: [
				{
					type: "number",
				},
				{
					type: "null",
				},
			],
		},
		params: {
			type: "any-of",
			contains: [
				{
					type: "dictionary",
					contains: {
						properties: {},
					},
				},
				{
					type: "null",
				},
			],
		},
		output: {
			type: "any-of",
			contains: [
				{
					type: "dictionary",
					contains: {
						properties: {},
					},
				},
				{
					type: "null",
				},
			],
		},
		total_steps: {
			type: "any-of",
			contains: [
				{
					type: "number",
				},
				{
					type: "null",
				},
			],
		},
		creator_id: {
			type: "string",
			isRequired: true,
			format: "uuid",
		},
		pod_name: {
			type: "string",
			isRequired: true,
		},
	},
} as const

export const $RunOut = {
	properties: {
		id: {
			type: "string",
			isRequired: true,
			format: "uuid",
		},
		name: {
			type: "string",
			isRequired: true,
		},
		workflow: {
			type: "string",
			isRequired: true,
		},
		status: {
			type: "WorkflowStatus",
			isRequired: true,
		},
		created_by: {
			type: "Users",
			isRequired: true,
		},
		params: {
			type: "any-of",
			contains: [
				{
					type: "dictionary",
					contains: {
						properties: {},
					},
				},
				{
					type: "null",
				},
			],
		},
		output: {
			type: "any-of",
			contains: [
				{
					type: "dictionary",
					contains: {
						properties: {},
					},
				},
				{
					type: "null",
				},
			],
		},
		updated_ts: {
			type: "string",
			isRequired: true,
			format: "date-time",
		},
		created_ts: {
			type: "string",
			isRequired: true,
			format: "date-time",
		},
	},
} as const

export const $RunUpdate = {
	properties: {
		status: {
			type: "WorkflowStatus",
			isRequired: true,
		},
		duration: {
			type: "number",
			isRequired: true,
		},
		total_steps: {
			type: "any-of",
			contains: [
				{
					type: "number",
				},
				{
					type: "null",
				},
			],
		},
		output: {
			type: "any-of",
			contains: [
				{
					type: "dictionary",
					contains: {
						properties: {},
					},
				},
				{
					type: "null",
				},
			],
		},
	},
} as const

export const $Runs = {
	properties: {
		id: {
			type: "string",
			isRequired: true,
			format: "uuid",
		},
		name: {
			type: "string",
			isRequired: true,
		},
		workflow: {
			type: "string",
			isRequired: true,
		},
		status: {
			type: "WorkflowStatus",
			isRequired: true,
		},
		created_by: {
			type: "Users",
			isRequired: true,
		},
		params: {
			type: "any-of",
			contains: [
				{
					type: "dictionary",
					contains: {
						properties: {},
					},
				},
				{
					type: "null",
				},
			],
		},
		output: {
			type: "any-of",
			contains: [
				{
					type: "dictionary",
					contains: {
						properties: {},
					},
				},
				{
					type: "null",
				},
			],
		},
		updated_ts: {
			type: "string",
			isRequired: true,
			format: "date-time",
		},
		created_ts: {
			type: "string",
			isRequired: true,
			format: "date-time",
		},
	},
} as const

export const $RunsOut = {
	properties: {
		data: {
			type: "array",
			contains: {
				type: "Runs",
			},
			isRequired: true,
		},
		count: {
			type: "number",
			isRequired: true,
		},
	},
} as const

export const $Token = {
	properties: {
		access_token: {
			type: "string",
			isRequired: true,
		},
		refresh_token: {
			type: "string",
			isRequired: true,
		},
		token_type: {
			type: "string",
			default: "bearer",
		},
	},
} as const

export const $UserCreate = {
	properties: {
		email: {
			type: "string",
			isRequired: true,
			format: "email",
		},
		full_name: {
			type: "any-of",
			contains: [
				{
					type: "string",
				},
				{
					type: "null",
				},
			],
		},
		is_active: {
			type: "boolean",
			default: true,
		},
		is_superuser: {
			type: "boolean",
			default: false,
		},
	},
} as const

export const $UserOut = {
	properties: {
		id: {
			type: "string",
			isRequired: true,
			format: "uuid",
		},
		full_name: {
			type: "any-of",
			contains: [
				{
					type: "string",
				},
				{
					type: "null",
				},
			],
			isRequired: true,
		},
		is_superuser: {
			type: "boolean",
			isRequired: true,
		},
		created_ts: {
			type: "string",
			isRequired: true,
			format: "date-time",
		},
	},
} as const

export const $UserUpdate = {
	properties: {
		email: {
			type: "any-of",
			contains: [
				{
					type: "string",
					format: "email",
				},
				{
					type: "null",
				},
			],
		},
		full_name: {
			type: "any-of",
			contains: [
				{
					type: "string",
				},
				{
					type: "null",
				},
			],
		},
	},
} as const

export const $Users = {
	properties: {
		id: {
			type: "string",
			isRequired: true,
			format: "uuid",
		},
		full_name: {
			type: "any-of",
			contains: [
				{
					type: "string",
				},
				{
					type: "null",
				},
			],
			isRequired: true,
		},
	},
} as const

export const $UsersOut = {
	properties: {
		data: {
			type: "array",
			contains: {
				type: "Users",
			},
			isRequired: true,
		},
		count: {
			type: "number",
			isRequired: true,
		},
	},
} as const

export const $ValidationError = {
	properties: {
		loc: {
			type: "array",
			contains: {
				type: "any-of",
				contains: [
					{
						type: "string",
					},
					{
						type: "number",
					},
				],
			},
			isRequired: true,
		},
		msg: {
			type: "string",
			isRequired: true,
		},
		type: {
			type: "string",
			isRequired: true,
		},
	},
} as const

export const $WorkflowStatus = {
	type: "Enum",
	enum: ["pending", "skipped", "started", "failed", "succeeded", "stopped"],
} as const
