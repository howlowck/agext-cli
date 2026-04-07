import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import type { AgentDocument, PluginMeta } from "../domain/types.js";
import { AGENT_MD_SUFFIX } from "../domain/paths.js";
import { parseAgentMd } from "./frontmatter.js";

/**
 * List all agent files from a plugin.
 */
export async function listAgents(plugin: PluginMeta): Promise<string[]> {
	const agentsPath = join(plugin.rootPath, plugin.agentsDir);
	if (!existsSync(agentsPath)) {
		return [];
	}

	const entries = await readdir(agentsPath);
	return entries
		.filter((f) => f.endsWith(AGENT_MD_SUFFIX))
		.map((f) => f.slice(0, -AGENT_MD_SUFFIX.length));
}

/**
 * Load and parse a specific agent document from a plugin.
 */
export async function loadAgent(
	plugin: PluginMeta,
	agentName: string,
): Promise<AgentDocument> {
	const agentPath = join(
		plugin.rootPath,
		plugin.agentsDir,
		`${agentName}${AGENT_MD_SUFFIX}`,
	);

	if (!existsSync(agentPath)) {
		throw new Error(`Agent file not found: ${agentPath}`);
	}

	const content = await readFile(agentPath, "utf-8");
	return parseAgentMd(content, agentName);
}
