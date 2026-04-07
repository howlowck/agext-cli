import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { AgentDocument, AgentFrontmatter } from "../domain/types.js";

/**
 * Parse a .agent.md file into frontmatter and body.
 * Expects `---` delimited YAML frontmatter at the top.
 */
export function parseAgentMd(content: string, fileName: string): AgentDocument {
	const trimmed = content.trimStart();
	if (!trimmed.startsWith("---")) {
		throw new Error(
			`Agent file "${fileName}" missing YAML frontmatter (no opening ---)`,
		);
	}

	const endIndex = trimmed.indexOf("---", 3);
	if (endIndex === -1) {
		throw new Error(
			`Agent file "${fileName}" has unclosed YAML frontmatter (no closing ---)`,
		);
	}

	const yamlBlock = trimmed.slice(3, endIndex).trim();
	const body = trimmed.slice(endIndex + 3).replace(/^\r?\n/, "");

	const frontmatter = parseYaml(yamlBlock) as AgentFrontmatter;

	if (!frontmatter || typeof frontmatter !== "object") {
		throw new Error(
			`Agent file "${fileName}" has invalid YAML frontmatter (not an object)`,
		);
	}

	if (!frontmatter.name || typeof frontmatter.name !== "string") {
		throw new Error(
			`Agent file "${fileName}" frontmatter missing required "name" field`,
		);
	}

	return { fileName, frontmatter, body };
}

/**
 * Serialize an agent document back to .agent.md format.
 */
export function serializeAgentMd(doc: AgentDocument): string {
	const yamlStr = stringifyYaml(doc.frontmatter, {
		lineWidth: 0,
		defaultStringType: "QUOTE_DOUBLE",
		defaultKeyType: "PLAIN",
	}).trimEnd();

	return `---\n${yamlStr}\n---\n${doc.body}`;
}
