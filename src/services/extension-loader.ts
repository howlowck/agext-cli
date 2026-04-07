import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { parse as parseYaml } from "yaml";
import type { AgentExtension, ResolvedExtension } from "../domain/types.js";
import { getRepoExtendDir, EXTEND_YAML_SUFFIX } from "../domain/paths.js";

/**
 * Discover all .extend.yaml files under .agext/extend/
 */
export async function discoverExtensions(
	repoRoot: string,
): Promise<ResolvedExtension[]> {
	const extendDir = getRepoExtendDir(repoRoot);
	if (!existsSync(extendDir)) {
		return [];
	}

	const results: ResolvedExtension[] = [];
	const pluginDirs = await readdir(extendDir, { withFileTypes: true });

	for (const pluginEntry of pluginDirs) {
		if (!pluginEntry.isDirectory()) continue;

		const pluginName = pluginEntry.name;
		const agentsDir = join(extendDir, pluginName, "agents");

		if (!existsSync(agentsDir)) continue;

		const files = await readdir(agentsDir);
		for (const file of files) {
			if (!file.endsWith(EXTEND_YAML_SUFFIX)) continue;

			const agentName = file.slice(0, -EXTEND_YAML_SUFFIX.length);
			const extensionPath = join(agentsDir, file);

			try {
				const raw = await readFile(extensionPath, "utf-8");
				const extension = parseYaml(raw) as AgentExtension;

				if (!extension || typeof extension !== "object") {
					console.warn(`Warning: Invalid extension file ${extensionPath}`);
					continue;
				}

				results.push({ pluginName, agentName, extension, extensionPath });
			} catch (err) {
				console.warn(
					`Warning: Failed to parse ${extensionPath}: ${(err as Error).message}`,
				);
			}
		}
	}

	return results;
}
