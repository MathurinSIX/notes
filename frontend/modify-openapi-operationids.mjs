import * as fs from "node:fs";

function fixEnumDefaults(schemas, property) {
	// Check if this property references an enum schema
	if (property.$ref) {
		const refName = property.$ref.split("/").pop();
		const enumSchema = schemas[refName];

		// If it's an enum schema and has a default value, inline the enum to fix TypeScript generation
		if (enumSchema?.enum && property.default !== undefined) {
			// Ensure default is a string matching one of the enum values
			let defaultValue = property.default;
			if (typeof defaultValue !== "string") {
				// If default is not a string, try to convert enum member name to value
				const defaultStr = String(defaultValue);
				if (enumSchema.enum.includes(defaultStr)) {
					defaultValue = defaultStr;
				} else {
					// Try to find matching enum value (case-insensitive)
					const matchingValue = enumSchema.enum.find(
						(val) => val.toLowerCase() === defaultStr.toLowerCase(),
					);
					if (matchingValue) {
						defaultValue = matchingValue;
					} else if (enumSchema.enum.length > 0) {
						// Fallback to first enum value if no match
						defaultValue = enumSchema.enum[0];
					}
				}
			} else {
				// Ensure the string default is a valid enum value
				if (!enumSchema.enum.includes(defaultValue)) {
					// Try case-insensitive match
					const matchingValue = enumSchema.enum.find(
						(val) => val.toLowerCase() === defaultValue.toLowerCase(),
					);
					if (matchingValue) {
						defaultValue = matchingValue;
					} else if (enumSchema.enum.length > 0) {
						// Fallback to first enum value
						defaultValue = enumSchema.enum[0];
					}
				}
			}

			// Inline the enum definition instead of using $ref to fix TypeScript generation
			// This ensures the default is treated as a string literal, not a variable reference
			delete property.$ref;
			property.type = enumSchema.type || "string";
			property.enum = [...enumSchema.enum];
			property.default = defaultValue;
			if (enumSchema.title) {
				property.title = enumSchema.title;
			}
		}
	}
}

function fixSchemaEnumDefaults(schemas) {
	for (const schemaName of Object.keys(schemas)) {
		const schema = schemas[schemaName];
		if (schema?.properties) {
			for (const propertyName of Object.keys(schema.properties)) {
				const property = schema.properties[propertyName];
				fixEnumDefaults(schemas, property);
			}
		}
	}
}

async function modifyOpenAPIFile(filePath) {
	try {
		const data = await fs.promises.readFile(filePath);
		const openapiContent = JSON.parse(data);

		const paths = openapiContent.paths;
		for (const pathKey of Object.keys(paths)) {
			const pathData = paths[pathKey];
			for (const method of Object.keys(pathData)) {
				const operation = pathData[method];
				if (operation.tags && operation.tags.length > 0) {
					const tag = operation.tags[0];
					const operationId = operation.operationId;
					const toRemove = `${tag}-`;
					if (operationId.startsWith(toRemove)) {
						const newOperationId = operationId.substring(toRemove.length);
						operation.operationId = newOperationId;
					}
				}
			}
		}

		// Fix enum defaults to ensure they are strings
		if (openapiContent.components?.schemas) {
			fixSchemaEnumDefaults(openapiContent.components.schemas);
		}

		await fs.promises.writeFile(
			filePath,
			JSON.stringify(openapiContent, null, 2),
		);
		console.log("File successfully modified");
	} catch (err) {
		console.error("Error:", err);
	}
}

const filePath = "./openapi.json";
modifyOpenAPIFile(filePath);
