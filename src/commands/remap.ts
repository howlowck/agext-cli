import { Command } from "commander";
import { readFile, mkdir, writeFile } from "fs/promises";
import { join, relative } from "path";
import { existsSync } from "fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { discoverPlugins } from "../services/plugin-discovery.js";
import { discoverExtensions } from "../services/extension-loader.js";
import { loadAgent } from "../services/agent-loader.js";
import {
	buildDependencyMap,
	computeSubagentRemaps,
	detectCycles,
} from "../services/dependency-map.js";
import {
	DEFAULT_NAME_SUFFIX,
	getRepoExtendPluginDir,
	EXTEND_YAML_SUFFIX,
} from "../domain/paths.js";
import type {
	AgentExtension,
	PluginMeta,
	ResolvedExtension,
} from "../domain/types.js";

export function remapCommand(): Command {
	const cmd = new Command("remap")
		.description(
			"Remap subagent references in .extend.yaml files based on overridden agent renames",
		)
		.action(async () => {
			const repoRoot = process.cwd();

			// 1. Discover existing extensions
			const extensions = await discoverExtensions(repoRoot);
			if (extensions.length === 0) {
				console.log(
					"No extension files found under .agext/extend/\n" +
						"Run `agext scaffold` to create one, then run `agext remap`.",
				);
				return;
			}

			// 2. Discover plugins
			const plugins = await discoverPlugins();
			const pluginsByName = new Map<string, PluginMeta>();
			for (const p of plugins) {
				pluginsByName.set(p.name, p);
			}

			// 3. Group extensions by plugin
			const extsByPlugin = new Map<string, ResolvedExtension[]>();
			for (const ext of extensions) {
				const list = extsByPlugin.get(ext.pluginName) ?? [];
				list.push(ext);
				extsByPlugin.set(ext.pluginName, list);
			}

			let totalCreated = 0;
			let totalUpdated = 0;

			// 4. Process each plugin
			for (const [pluginName, pluginExts] of extsByPlugin) {
				const plugin = pluginsByName.get(pluginName);
				if (!plugin) {
					console.error(
						`Plugin "${pluginName}" not found in installed plugins.`,
					);
					continue;
				}

				// 4a. Compute renames from existing extensions
				const renames = new Map<string, string>();
				for (const ext of pluginExts) {
					try {
						const baseAgent = await loadAgent(plugin, ext.agentName);
						const suffix = ext.extension["name-suffix"] ?? DEFAULT_NAME_SUFFIX;
						const newName = baseAgent.frontmatter.name + suffix;
						if (newName !== baseAgent.frontmatter.name) {
							renames.set(baseAgent.frontmatter.name, newName);
						}
					} catch (err) {
						console.warn(
							`Warning: Could not load agent "${ext.agentName}" from plugin "${pluginName}": ${(err as Error).message}`,
						);
					}
				}

				if (renames.size === 0) {
					console.log(
						`\nPlugin "${pluginName}": No renames detected. Nothing to remap.`,
					);
					continue;
				}

				// 4b. Build dependency map
				const depMap = await buildDependencyMap(plugin);

				// 4c. Report cycles
				const cycles = detectCycles(depMap);
				if (cycles.length > 0) {
					console.log(
						`\nPlugin "${pluginName}" — Circular subagent references detected:`,
					);
					for (const cycle of cycles) {
						console.log(`  ⟳  ${cycle.join(" → ")}`);
					}
				}

				// 4d. Print dependency map
				console.log(`\nPlugin "${pluginName}" — Dependency map:`);
				for (const [displayName, node] of depMap) {
					const allRefs = [...node.subagentNames, ...node.handoffAgentNames];
					if (allRefs.length > 0) {
						console.log(`  ${displayName} → ${allRefs.join(", ")}`);
					}
				}

				// 4e. Print renames
				console.log(`\nRenames from existing extensions:`);
				for (const [oldName, newName] of renames) {
					console.log(`  "${oldName}" → "${newName}"`);
				}

				// 4f. Compute subagent remaps
				const remaps = computeSubagentRemaps(depMap, renames);

				if (remaps.size === 0) {
					console.log(
						`\nNo agents reference overridden subagents. Nothing to remap.`,
					);
					continue;
				}

				// 4g. Create/edit .extend.yaml files
				console.log(`\nSubagent remaps:`);
				const extendDir = getRepoExtendPluginDir(repoRoot, pluginName);
				await mkdir(extendDir, { recursive: true });

				const existingExtAgents = new Set(pluginExts.map((e) => e.agentName));

				for (const [agentFileName, remapInfo] of remaps) {
					const { displayName, agentRemaps, handoffRemaps, rawHandoffs } =
						remapInfo;
					const extPath = join(
						extendDir,
						`${agentFileName}${EXTEND_YAML_SUFFIX}`,
					);
					const isExisting =
						existingExtAgents.has(agentFileName) && existsSync(extPath);

					// Build agents remap entries using negation syntax
					const remapEntries: string[] = [];
					for (const [oldName, newName] of agentRemaps) {
						remapEntries.push(`!${oldName}`);
						remapEntries.push(newName);
					}

					// Build remapped handoffs array (clone with updated agent names)
					let remappedHandoffs: Record<string, unknown>[] | undefined;
					if (handoffRemaps.size > 0 && rawHandoffs.length > 0) {
						remappedHandoffs = rawHandoffs.map((h) => {
							const agentName = h.agent as string;
							if (agentName && handoffRemaps.has(agentName)) {
								return { ...h, agent: handoffRemaps.get(agentName)! };
							}
							return { ...h };
						});
					}

					const allRemaps = new Map([...agentRemaps, ...handoffRemaps]);

					if (isExisting) {
						// Edit existing .extend.yaml
						const raw = await readFile(extPath, "utf-8");
						const ext = (parseYaml(raw) as AgentExtension) ?? {};

						if (remapEntries.length > 0) {
							const existingAgents = ext.agents ?? [];
							for (const entry of remapEntries) {
								if (!existingAgents.includes(entry)) {
									existingAgents.push(entry);
								}
							}
							ext.agents = existingAgents;
						}

						if (remappedHandoffs) {
							(ext as Record<string, unknown>).handoffs = remappedHandoffs;
						}

						const yaml = stringifyYaml(ext, { lineWidth: 80 });
						await writeFile(extPath, yaml, "utf-8");

						const relPath = relative(repoRoot, extPath);
						console.log(`  ✏  Updated ${relPath} (${displayName})`);
						for (const [oldName, newName] of allRemaps) {
							console.log(`      "${oldName}" → "${newName}"`);
						}
						totalUpdated++;
					} else {
						// Create new remap-only .extend.yaml (no name change)
						const newExt: Record<string, unknown> = {
							"name-suffix": "",
						};
						if (remapEntries.length > 0) {
							newExt.agents = remapEntries;
						}
						if (remappedHandoffs) {
							newExt.handoffs = remappedHandoffs;
						}

						const yaml = stringifyYaml(newExt, { lineWidth: 80 });
						const header =
							`# Auto-generated by \`agext remap\`\n` +
							`# Remaps subagent references for: ${displayName}\n\n`;
						await writeFile(extPath, header + yaml, "utf-8");

						const relPath = relative(repoRoot, extPath);
						console.log(`  ✓  Created ${relPath} (${displayName})`);
						for (const [oldName, newName] of allRemaps) {
							console.log(`      "${oldName}" → "${newName}"`);
						}
						totalCreated++;
					}
				}
			}

			console.log(`\nDone: ${totalCreated} created, ${totalUpdated} updated.`);
			console.log("Run `agext apply` to generate the agent files.");
		});

	return cmd;
}
