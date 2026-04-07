import { describe, it, expect } from "vitest";
import { mergeAgent } from "../src/services/merge-agent";
import type { AgentDocument, AgentExtension } from "../src/domain/types";

function makeBaseAgent(overrides?: Partial<AgentDocument>): AgentDocument {
	return {
		fileName: "test-agent",
		frontmatter: {
			name: "TestAgent (The Tester)",
			description: "A test agent",
			tools: ["read", "search"],
			model: ["GPT-5", "gpt-5"],
		},
		body: "\nYou are TestAgent.\n",
		...overrides,
	};
}

describe("mergeAgent", () => {
	it("applies default name suffix", () => {
		const base = makeBaseAgent();
		const ext: AgentExtension = {};
		const result = mergeAgent(base, ext);
		expect(result.frontmatter.name).toBe(
			"TestAgent (The Tester) - Repo Extended",
		);
	});

	it("applies custom name suffix", () => {
		const base = makeBaseAgent();
		const ext: AgentExtension = { "name-suffix": " - Custom" };
		const result = mergeAgent(base, ext);
		expect(result.frontmatter.name).toBe("TestAgent (The Tester) - Custom");
	});

	it("merges tools additively (union, no duplicates)", () => {
		const base = makeBaseAgent();
		const ext: AgentExtension = { tools: ["browser", "read"] };
		const result = mergeAgent(base, ext);
		expect(result.frontmatter.tools).toEqual(["read", "search", "browser"]);
	});

	it("removes tools with ! negation prefix", () => {
		const base = makeBaseAgent();
		const ext: AgentExtension = { tools: ["!search", "browser"] };
		const result = mergeAgent(base, ext);
		expect(result.frontmatter.tools).toEqual(["read", "browser"]);
	});

	it("removes agents with ! negation prefix", () => {
		const base = makeBaseAgent({
			frontmatter: {
				name: "Test",
				agents: ["AgentA", "AgentB", "AgentC"],
			},
		});
		const ext: AgentExtension = { agents: ["!AgentB"] };
		const result = mergeAgent(base, ext);
		expect(result.frontmatter.agents).toEqual(["AgentA", "AgentC"]);
	});

	it("negation of non-existent item is a no-op", () => {
		const base = makeBaseAgent();
		const ext: AgentExtension = { tools: ["!nonexistent"] };
		const result = mergeAgent(base, ext);
		expect(result.frontmatter.tools).toEqual(["read", "search"]);
	});

	it("replaces model", () => {
		const base = makeBaseAgent();
		const ext: AgentExtension = { model: ["Claude", "claude"] };
		const result = mergeAgent(base, ext);
		expect(result.frontmatter.model).toEqual(["Claude", "claude"]);
	});

	it("replaces description", () => {
		const base = makeBaseAgent();
		const ext: AgentExtension = { description: "New description" };
		const result = mergeAgent(base, ext);
		expect(result.frontmatter.description).toBe("New description");
	});

	it("appends content to body", () => {
		const base = makeBaseAgent();
		const ext: AgentExtension = {
			"append-instructions": "Extra instructions at the end.",
		};
		const result = mergeAgent(base, ext);
		expect(result.body).toContain("You are TestAgent.");
		expect(result.body).toContain("Extra instructions at the end.");
	});

	it("prepends content to body", () => {
		const base = makeBaseAgent();
		const ext: AgentExtension = {
			"prepend-instructions": "Setup instructions first.",
		};
		const result = mergeAgent(base, ext);
		const prependIdx = result.body.indexOf("Setup instructions first.");
		const bodyIdx = result.body.indexOf("You are TestAgent.");
		expect(prependIdx).toBeLessThan(bodyIdx);
	});

	it("preserves body when no prepend/append given", () => {
		const base = makeBaseAgent();
		const ext: AgentExtension = { description: "Override" };
		const result = mergeAgent(base, ext);
		expect(result.body).toBe(base.body);
	});

	it("merges agents additively", () => {
		const base = makeBaseAgent({
			frontmatter: {
				name: "Test",
				agents: ["AgentA"],
			},
		});
		const ext: AgentExtension = { agents: ["AgentB", "AgentA"] };
		const result = mergeAgent(base, ext);
		expect(result.frontmatter.agents).toEqual(["AgentA", "AgentB"]);
	});
});
