import type { PluginMeta } from "../domain/types.js";
import { listAgents, loadAgent } from "./agent-loader.js";

/** A node in the agent dependency graph */
export interface AgentNode {
	/** Agent file name (without extension) */
	fileName: string;
	/** Agent display name from frontmatter */
	displayName: string;
	/** Display names of referenced subagents */
	subagentNames: string[];
	/** Display names of agents referenced in handoffs[].agent */
	handoffAgentNames: string[];
	/** Raw handoffs array from frontmatter (for cloning during remap) */
	rawHandoffs: Record<string, unknown>[];
}

/**
 * Build a dependency map of all agents in a plugin.
 * Maps agent display name → AgentNode.
 */
export async function buildDependencyMap(
	plugin: PluginMeta,
): Promise<Map<string, AgentNode>> {
	const map = new Map<string, AgentNode>();
	const fileNames = await listAgents(plugin);

	for (const fileName of fileNames) {
		const doc = await loadAgent(plugin, fileName);
		const rawHandoffs =
			(doc.frontmatter.handoffs as Record<string, unknown>[] | undefined) ?? [];
		const handoffAgentNames = rawHandoffs
			.map((h) => h.agent as string)
			.filter(Boolean);

		map.set(doc.frontmatter.name, {
			fileName,
			displayName: doc.frontmatter.name,
			subagentNames: doc.frontmatter.agents ?? [],
			handoffAgentNames,
			rawHandoffs,
		});
	}

	return map;
}

/**
 * Given a dependency map and a rename table (old display name → new display name),
 * compute which agents need their subagent references updated.
 *
 * Only checks direct references — no transitive resolution needed.
 * Circular subagent references are inherently safe since we scan each agent exactly once.
 *
 * Returns a map: agent file name → { displayName, remaps: oldName → newName }
 */
/** Result of computing subagent remaps for a single agent */
export interface AgentRemapInfo {
	displayName: string;
	/** Remaps needed in the agents[] field (oldName → newName) */
	agentRemaps: Map<string, string>;
	/** Remaps needed in handoffs[].agent (oldName → newName) */
	handoffRemaps: Map<string, string>;
	/** Raw handoffs from the base agent (for cloning with updated names) */
	rawHandoffs: Record<string, unknown>[];
}

export function computeSubagentRemaps(
	depMap: Map<string, AgentNode>,
	renames: Map<string, string>,
): Map<string, AgentRemapInfo> {
	const result = new Map<string, AgentRemapInfo>();

	for (const [, node] of depMap) {
		const agentRemaps = new Map<string, string>();
		const handoffRemaps = new Map<string, string>();

		for (const subName of node.subagentNames) {
			if (renames.has(subName)) {
				agentRemaps.set(subName, renames.get(subName)!);
			}
		}

		for (const handoffName of node.handoffAgentNames) {
			if (renames.has(handoffName)) {
				handoffRemaps.set(handoffName, renames.get(handoffName)!);
			}
		}

		if (agentRemaps.size > 0 || handoffRemaps.size > 0) {
			result.set(node.fileName, {
				displayName: node.displayName,
				agentRemaps,
				handoffRemaps,
				rawHandoffs: node.rawHandoffs,
			});
		}
	}

	return result;
}

/**
 * Detect cycles in the agent dependency graph.
 * Returns an array of cycles, where each cycle is an array of display names
 * forming the cycle path (e.g. ["A", "B", "A"]).
 */
export function detectCycles(depMap: Map<string, AgentNode>): string[][] {
	const cycles: string[][] = [];
	const visited = new Set<string>();
	const inStack = new Set<string>();
	const path: string[] = [];

	function dfs(name: string): void {
		if (inStack.has(name)) {
			const cycleStart = path.indexOf(name);
			cycles.push([...path.slice(cycleStart), name]);
			return;
		}
		if (visited.has(name)) return;

		visited.add(name);
		inStack.add(name);
		path.push(name);

		const node = depMap.get(name);
		if (node) {
			const allRefs = [...node.subagentNames, ...node.handoffAgentNames];
			for (const sub of allRefs) {
				if (depMap.has(sub)) {
					dfs(sub);
				}
			}
		}

		path.pop();
		inStack.delete(name);
	}

	for (const name of depMap.keys()) {
		dfs(name);
	}

	return cycles;
}
