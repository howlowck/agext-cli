import { stringify as yamlStringify } from "yaml";
import type { AgentDocument } from "../domain/types.js";

/**
 * Generate a scaffold .extend.yaml template from a base agent.
 */
export function generateExtendTemplate(base: AgentDocument): string {
	const fm = base.frontmatter;

	const template: Record<string, unknown> = {};

	// Include name-suffix as a commented default
	template["name-suffix"] = " - Repo Extended";

	// Include key frontmatter fields if they exist in the base
	if (fm.description) {
		template["description"] = fm.description;
	}

	if (fm.tools && fm.tools.length > 0) {
		template["tools"] = [];
	}

	if (fm.agents && fm.agents.length > 0) {
		template["agents"] = [];
	}

	if (fm.model) {
		template["model"] = fm.model;
	}

	// Include prepend and append instruction blocks
	template["prepend-instructions"] =
		"# Instructions inserted BEFORE the base agent body.";

	template["append-instructions"] =
		"# Instructions inserted AFTER the base agent body.";

	// AI editor fields (empty by default so AI edit pass doesn't auto-run)
	template["ai-editor-instructions"] = "";
	template["ai-editor-model"] = "gpt-5";

	const yaml = yamlStringify(template, { lineWidth: 80 });

	return `# Extension overrides for: ${fm.name}\n# Plugin agent: ${base.fileName}.agent.md\n#\n# Fields:\n#   name-suffix              - Suffix appended to agent name (default: " - Repo Extended")\n#   description              - Replaces the base agent description\n#   tools                    - Additional tools (merged with base, no duplicates)\n#   agents                   - Additional agents (merged with base, no duplicates)\n#   model                    - Replaces the base agent model\n#   prepend-instructions     - Markdown inserted before the agent body\n#   append-instructions      - Markdown inserted after the agent body\n#   ai-editor-instructions   - AI edit pass instructions (uses Copilot SDK)\n#   ai-editor-model          - Model for the AI edit pass (default: gpt-5)\n\n${yaml}`;
}
