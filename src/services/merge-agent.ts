import type {
	AgentDocument,
	AgentExtension,
	AgentFrontmatter,
} from "../domain/types.js";
import { DEFAULT_NAME_SUFFIX } from "../domain/paths.js";

/** Fields that use additive (union) merge semantics */
const ADDITIVE_FIELDS = new Set(["tools", "agents"]);

/** Fields that are internal to the extension schema and not frontmatter overrides */
const EXTENSION_ONLY_FIELDS = new Set([
	"name-suffix",
	"prepend-instructions",
	"append-instructions",
	"ai-editor-instructions",
	"ai-editor-model",
]);

/**
 * Merge a base agent document with an extension.
 * Returns a new AgentDocument with merged frontmatter and appended instructions.
 */
export function mergeAgent(
	base: AgentDocument,
	extension: AgentExtension,
): AgentDocument {
	const suffix = extension["name-suffix"] ?? DEFAULT_NAME_SUFFIX;

	// Clone base frontmatter
	const merged: AgentFrontmatter = { ...base.frontmatter };

	// Apply name suffix
	merged.name = base.frontmatter.name + suffix;

	// Merge each extension field
	for (const [key, value] of Object.entries(extension)) {
		if (EXTENSION_ONLY_FIELDS.has(key)) continue;
		if (value === undefined || value === null) continue;

		if (ADDITIVE_FIELDS.has(key) && Array.isArray(value)) {
			// Union merge for array fields, with ! prefix for negation
			const existing = (merged[key] as string[] | undefined) ?? [];
			let combined = [...existing];
			for (const item of value) {
				if (item.startsWith("!")) {
					// Remove the negated item from the list
					const toRemove = item.slice(1);
					combined = combined.filter((i) => i !== toRemove);
				} else if (!combined.includes(item)) {
					combined.push(item);
				}
			}
			merged[key] = combined;
		} else {
			// Replacement merge for scalar fields
			merged[key] = value;
		}
	}

	// Prepend/append instructions to body
	let body = base.body;
	if (extension["prepend-instructions"]) {
		body = "\n" + extension["prepend-instructions"].trimEnd() + "\n" + body;
	}
	if (extension["append-instructions"]) {
		body =
			body.trimEnd() +
			"\n\n" +
			extension["append-instructions"].trimEnd() +
			"\n";
	}

	return {
		fileName: base.fileName,
		frontmatter: merged,
		body,
	};
}
