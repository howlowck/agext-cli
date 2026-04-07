import { readdir, readFile } from "fs/promises";
import { join, relative } from "path";
import { existsSync } from "fs";
import type { PluginMeta } from "../domain/types.js";
import { getAgentPluginsRoot } from "../domain/paths.js";

/**
 * Discover all installed VS Code agent plugins.
 * Walks the agent-plugins directory tree looking for plugin.json files.
 */
export async function discoverPlugins(): Promise<PluginMeta[]> {
	const root = getAgentPluginsRoot();
	if (!existsSync(root)) {
		return [];
	}

	const plugins: PluginMeta[] = [];
	await walkForPlugins(root, root, plugins);

	// Deduplicate by name, keeping the shallowest (first-found) entry
	const seen = new Map<string, PluginMeta>();
	for (const p of plugins) {
		if (!seen.has(p.name)) {
			seen.set(p.name, p);
		}
	}
	return [...seen.values()];
}

async function walkForPlugins(
	dir: string,
	root: string,
	results: PluginMeta[],
): Promise<void> {
	const pluginJsonPath = join(dir, "plugin.json");

	if (existsSync(pluginJsonPath)) {
		try {
			const raw = JSON.parse(await readFile(pluginJsonPath, "utf-8"));
			const relPath = relative(root, dir);

			results.push({
				name: raw.name ?? relPath,
				rootPath: dir,
				agentsDir: raw.agents ?? ".github/agents/",
				raw,
			});
		} catch (err) {
			console.warn(
				`Warning: Failed to parse ${pluginJsonPath}: ${(err as Error).message}`,
			);
		}
		return; // Don't recurse deeper once we found a plugin.json
	}

	// Recurse into subdirectories (agent-plugins uses nested paths like github.com/user/repo)
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isDirectory() && entry.name !== ".git") {
				await walkForPlugins(join(dir, entry.name), root, results);
			}
		}
	} catch {
		// Skip unreadable directories
	}
}
