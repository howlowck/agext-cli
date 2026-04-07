import { describe, it, expect } from "vitest";
import { generateExtendTemplate } from "../src/services/template-writer";
import type { AgentDocument } from "../src/domain/types";

describe("generateExtendTemplate", () => {
	it("generates template with agent metadata", () => {
		const agent: AgentDocument = {
			fileName: "test-agent",
			frontmatter: {
				name: "TestAgent (The Tester)",
				description: "A test agent",
				tools: ["read", "search"],
				model: ["GPT-5"],
			},
			body: "Body here.",
		};

		const template = generateExtendTemplate(agent);
		expect(template).toContain(
			"# Extension overrides for: TestAgent (The Tester)",
		);
		expect(template).toContain("test-agent.agent.md");
		expect(template).toContain("name-suffix");
		expect(template).toContain("Repo Extended");
		expect(template).toContain("prepend-instructions");
		expect(template).toContain("append-instructions");
	});

	it("includes model from base agent", () => {
		const agent: AgentDocument = {
			fileName: "my-agent",
			frontmatter: {
				name: "MyAgent",
				model: ["Claude", "claude"],
			},
			body: "",
		};

		const template = generateExtendTemplate(agent);
		expect(template).toContain("model");
		expect(template).toContain("Claude");
	});
});
