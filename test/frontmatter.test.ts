import { describe, it, expect } from "vitest";
import { parseAgentMd, serializeAgentMd } from "../src/services/frontmatter";

describe("parseAgentMd", () => {
	it("parses valid frontmatter and body", () => {
		const content = `---
name: TestAgent
description: "A test agent"
tools:
  - read
  - search
---

You are TestAgent.
`;
		const doc = parseAgentMd(content, "test-agent");
		expect(doc.frontmatter.name).toBe("TestAgent");
		expect(doc.frontmatter.description).toBe("A test agent");
		expect(doc.frontmatter.tools).toEqual(["read", "search"]);
		expect(doc.body).toContain("You are TestAgent.");
		expect(doc.fileName).toBe("test-agent");
	});

	it("throws on missing opening ---", () => {
		expect(() => parseAgentMd("no frontmatter here", "bad")).toThrow(
			"missing YAML frontmatter",
		);
	});

	it("throws on unclosed frontmatter", () => {
		expect(() => parseAgentMd("---\nname: Test\nno closing", "bad")).toThrow(
			"unclosed YAML frontmatter",
		);
	});

	it("throws on missing name field", () => {
		const content = `---
description: "no name"
---
body`;
		expect(() => parseAgentMd(content, "bad")).toThrow(
			'missing required "name"',
		);
	});
});

describe("serializeAgentMd", () => {
	it("round-trips a parsed document", () => {
		const content = `---
name: TestAgent
description: "A test agent"
tools:
  - read
---

Body text here.
`;
		const doc = parseAgentMd(content, "test");
		const serialized = serializeAgentMd(doc);
		expect(serialized).toContain("---");
		expect(serialized).toContain("TestAgent");
		expect(serialized).toContain("Body text here.");
	});
});
