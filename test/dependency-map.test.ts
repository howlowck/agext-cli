import { describe, it, expect } from "vitest";
import {
	buildDependencyMap,
	computeSubagentRemaps,
	detectCycles,
	type AgentNode,
} from "../src/services/dependency-map.js";

/** Helper to build a dep map from plain objects */
function makeDepMap(
	nodes: {
		fileName: string;
		displayName: string;
		subagentNames: string[];
		handoffAgentNames?: string[];
		rawHandoffs?: Record<string, unknown>[];
	}[],
): Map<string, AgentNode> {
	const map = new Map<string, AgentNode>();
	for (const n of nodes) {
		map.set(n.displayName, {
			...n,
			handoffAgentNames: n.handoffAgentNames ?? [],
			rawHandoffs: n.rawHandoffs ?? [],
		});
	}
	return map;
}

describe("computeSubagentRemaps", () => {
	it("returns empty when no renames match any subagent references", () => {
		const depMap = makeDepMap([
			{
				fileName: "agent-a",
				displayName: "Agent A",
				subagentNames: ["Agent B"],
			},
			{ fileName: "agent-b", displayName: "Agent B", subagentNames: [] },
		]);
		const renames = new Map([["Agent C", "Agent C - Extended"]]);

		const result = computeSubagentRemaps(depMap, renames);
		expect(result.size).toBe(0);
	});

	it("detects direct subagent references that need remapping", () => {
		const depMap = makeDepMap([
			{
				fileName: "agent-a",
				displayName: "Agent A",
				subagentNames: ["Agent B", "Agent C"],
			},
			{ fileName: "agent-b", displayName: "Agent B", subagentNames: [] },
			{ fileName: "agent-c", displayName: "Agent C", subagentNames: [] },
		]);
		const renames = new Map([["Agent B", "Agent B - Extended"]]);

		const result = computeSubagentRemaps(depMap, renames);
		expect(result.size).toBe(1);
		expect(result.has("agent-a")).toBe(true);

		const entry = result.get("agent-a")!;
		expect(entry.displayName).toBe("Agent A");
		expect(entry.agentRemaps.get("Agent B")).toBe("Agent B - Extended");
	});

	it("handles multiple renames affecting the same agent", () => {
		const depMap = makeDepMap([
			{
				fileName: "orchestrator",
				displayName: "Orchestrator",
				subagentNames: ["Worker A", "Worker B"],
			},
			{ fileName: "worker-a", displayName: "Worker A", subagentNames: [] },
			{ fileName: "worker-b", displayName: "Worker B", subagentNames: [] },
		]);
		const renames = new Map([
			["Worker A", "Worker A - Extended"],
			["Worker B", "Worker B - Extended"],
		]);

		const result = computeSubagentRemaps(depMap, renames);
		expect(result.size).toBe(1);

		const entry = result.get("orchestrator")!;
		expect(entry.agentRemaps.size).toBe(2);
		expect(entry.agentRemaps.get("Worker A")).toBe("Worker A - Extended");
		expect(entry.agentRemaps.get("Worker B")).toBe("Worker B - Extended");
	});

	it("handles multiple agents needing remaps", () => {
		const depMap = makeDepMap([
			{
				fileName: "agent-a",
				displayName: "Agent A",
				subagentNames: ["Agent C"],
			},
			{
				fileName: "agent-b",
				displayName: "Agent B",
				subagentNames: ["Agent C"],
			},
			{ fileName: "agent-c", displayName: "Agent C", subagentNames: [] },
		]);
		const renames = new Map([["Agent C", "Agent C - Extended"]]);

		const result = computeSubagentRemaps(depMap, renames);
		expect(result.size).toBe(2);
		expect(result.has("agent-a")).toBe(true);
		expect(result.has("agent-b")).toBe(true);
	});

	it("does not remap the renamed agent itself", () => {
		const depMap = makeDepMap([
			{
				fileName: "agent-a",
				displayName: "Agent A",
				subagentNames: ["Agent B"],
			},
			{ fileName: "agent-b", displayName: "Agent B", subagentNames: [] },
		]);
		// Agent B is renamed — Agent B itself should not appear in remaps
		const renames = new Map([["Agent B", "Agent B - Extended"]]);

		const result = computeSubagentRemaps(depMap, renames);
		expect(result.has("agent-b")).toBe(false);
		expect(result.has("agent-a")).toBe(true);
	});

	it("handles circular references without infinite loop", () => {
		const depMap = makeDepMap([
			{
				fileName: "agent-a",
				displayName: "Agent A",
				subagentNames: ["Agent B"],
			},
			{
				fileName: "agent-b",
				displayName: "Agent B",
				subagentNames: ["Agent A"],
			},
		]);
		const renames = new Map([["Agent A", "Agent A - Extended"]]);

		const result = computeSubagentRemaps(depMap, renames);
		// Only Agent B references Agent A, so only B needs remap
		expect(result.size).toBe(1);
		expect(result.has("agent-b")).toBe(true);
		expect(result.get("agent-b")!.agentRemaps.get("Agent A")).toBe(
			"Agent A - Extended",
		);
	});

	it("handles mutual circular references with both renamed", () => {
		const depMap = makeDepMap([
			{
				fileName: "agent-a",
				displayName: "Agent A",
				subagentNames: ["Agent B"],
			},
			{
				fileName: "agent-b",
				displayName: "Agent B",
				subagentNames: ["Agent A"],
			},
		]);
		const renames = new Map([
			["Agent A", "Agent A - Extended"],
			["Agent B", "Agent B - Extended"],
		]);

		const result = computeSubagentRemaps(depMap, renames);
		expect(result.size).toBe(2);
		expect(result.get("agent-a")!.agentRemaps.get("Agent B")).toBe(
			"Agent B - Extended",
		);
		expect(result.get("agent-b")!.agentRemaps.get("Agent A")).toBe(
			"Agent A - Extended",
		);
	});
});

describe("detectCycles", () => {
	it("returns empty for acyclic graph", () => {
		const depMap = makeDepMap([
			{ fileName: "a", displayName: "A", subagentNames: ["B"] },
			{ fileName: "b", displayName: "B", subagentNames: ["C"] },
			{ fileName: "c", displayName: "C", subagentNames: [] },
		]);

		const cycles = detectCycles(depMap);
		expect(cycles).toHaveLength(0);
	});

	it("detects a simple cycle", () => {
		const depMap = makeDepMap([
			{ fileName: "a", displayName: "A", subagentNames: ["B"] },
			{ fileName: "b", displayName: "B", subagentNames: ["A"] },
		]);

		const cycles = detectCycles(depMap);
		expect(cycles.length).toBeGreaterThan(0);
		// Cycle should contain both A and B
		const flat = cycles.flat();
		expect(flat).toContain("A");
		expect(flat).toContain("B");
	});

	it("detects a three-node cycle", () => {
		const depMap = makeDepMap([
			{ fileName: "a", displayName: "A", subagentNames: ["B"] },
			{ fileName: "b", displayName: "B", subagentNames: ["C"] },
			{ fileName: "c", displayName: "C", subagentNames: ["A"] },
		]);

		const cycles = detectCycles(depMap);
		expect(cycles.length).toBeGreaterThan(0);
	});

	it("handles self-referencing agent", () => {
		const depMap = makeDepMap([
			{ fileName: "a", displayName: "A", subagentNames: ["A"] },
		]);

		const cycles = detectCycles(depMap);
		expect(cycles.length).toBeGreaterThan(0);
		expect(cycles[0]).toEqual(["A", "A"]);
	});

	it("ignores references to agents not in the graph", () => {
		const depMap = makeDepMap([
			{ fileName: "a", displayName: "A", subagentNames: ["External"] },
		]);

		const cycles = detectCycles(depMap);
		expect(cycles).toHaveLength(0);
	});

	it("detects cycles via handoff references", () => {
		const depMap = makeDepMap([
			{
				fileName: "a",
				displayName: "A",
				subagentNames: [],
				handoffAgentNames: ["B"],
				rawHandoffs: [{ label: "Go to B", agent: "B" }],
			},
			{
				fileName: "b",
				displayName: "B",
				subagentNames: [],
				handoffAgentNames: ["A"],
				rawHandoffs: [{ label: "Go to A", agent: "A" }],
			},
		]);

		const cycles = detectCycles(depMap);
		expect(cycles.length).toBeGreaterThan(0);
		const flat = cycles.flat();
		expect(flat).toContain("A");
		expect(flat).toContain("B");
	});
});

describe("computeSubagentRemaps — handoffs", () => {
	it("detects handoff agent references that need remapping", () => {
		const depMap = makeDepMap([
			{
				fileName: "orchestrator",
				displayName: "Orchestrator",
				subagentNames: [],
				handoffAgentNames: ["Worker"],
				rawHandoffs: [{ label: "Execute", agent: "Worker", prompt: "do it" }],
			},
			{
				fileName: "worker",
				displayName: "Worker",
				subagentNames: [],
			},
		]);
		const renames = new Map([["Worker", "Worker - Extended"]]);

		const result = computeSubagentRemaps(depMap, renames);
		expect(result.size).toBe(1);
		expect(result.has("orchestrator")).toBe(true);

		const entry = result.get("orchestrator")!;
		expect(entry.handoffRemaps.get("Worker")).toBe("Worker - Extended");
		expect(entry.rawHandoffs).toHaveLength(1);
		expect(entry.rawHandoffs[0].agent).toBe("Worker");
	});

	it("returns both agentRemaps and handoffRemaps when both exist", () => {
		const depMap = makeDepMap([
			{
				fileName: "boss",
				displayName: "Boss",
				subagentNames: ["Helper"],
				handoffAgentNames: ["Runner"],
				rawHandoffs: [{ label: "Run", agent: "Runner" }],
			},
			{
				fileName: "helper",
				displayName: "Helper",
				subagentNames: [],
			},
			{
				fileName: "runner",
				displayName: "Runner",
				subagentNames: [],
			},
		]);
		const renames = new Map([
			["Helper", "Helper - Extended"],
			["Runner", "Runner - Extended"],
		]);

		const result = computeSubagentRemaps(depMap, renames);
		expect(result.size).toBe(1);

		const entry = result.get("boss")!;
		expect(entry.agentRemaps.get("Helper")).toBe("Helper - Extended");
		expect(entry.handoffRemaps.get("Runner")).toBe("Runner - Extended");
	});

	it("handles handoff-only remaps (no subagent remaps)", () => {
		const depMap = makeDepMap([
			{
				fileName: "planner",
				displayName: "Planner",
				subagentNames: ["Finder"],
				handoffAgentNames: ["Doer"],
				rawHandoffs: [{ label: "Execute", agent: "Doer", send: false }],
			},
			{
				fileName: "finder",
				displayName: "Finder",
				subagentNames: [],
			},
			{
				fileName: "doer",
				displayName: "Doer",
				subagentNames: [],
			},
		]);
		// Only Doer is renamed — Finder is not
		const renames = new Map([["Doer", "Doer - Extended"]]);

		const result = computeSubagentRemaps(depMap, renames);
		expect(result.size).toBe(1);
		expect(result.has("planner")).toBe(true);

		const entry = result.get("planner")!;
		expect(entry.agentRemaps.size).toBe(0);
		expect(entry.handoffRemaps.get("Doer")).toBe("Doer - Extended");
	});
});
