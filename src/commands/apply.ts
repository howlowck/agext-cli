import { Command } from "commander";
import { mkdir, writeFile } from "fs/promises";
import { relative } from "path";
import { discoverPlugins } from "../services/plugin-discovery.js";
import { discoverExtensions } from "../services/extension-loader.js";
import { loadAgent } from "../services/agent-loader.js";
import { mergeAgent } from "../services/merge-agent.js";
import { serializeAgentMd } from "../services/frontmatter.js";
import {
	getRepoAgentsDir,
	getRepoExtendDir,
	getAgentPluginsRoot,
} from "../domain/paths.js";
import { aiEdit } from "../services/ai-editor.js";
import type { PluginMeta } from "../domain/types.js";
import { join } from "path";

export function applyCommand(): Command {
	const cmd = new Command("apply")
		.description(
			"Apply all .extend.yaml overrides to generate repo-local agent files",
		)
		.action(async () => {
			const repoRoot = process.cwd();

			// 1. Discover extensions
			const extensions = await discoverExtensions(repoRoot);
			if (extensions.length === 0) {
				console.log(
					"No extension files found under .agext/extend/\n" +
						"Run `agext scaffold` to create one.",
				);
				return;
			}

			// 2. Discover plugins (for resolving base agents)
			const plugins = await discoverPlugins();
			const pluginsByName = new Map<string, PluginMeta>();
			for (const p of plugins) {
				pluginsByName.set(p.name, p);
			}

			// 3. Process each extension
			const outputDir = getRepoAgentsDir(repoRoot);
			await mkdir(outputDir, { recursive: true });

			let successCount = 0;
			let errorCount = 0;
			const renamesByPlugin = new Map<string, { from: string; to: string }[]>();

			for (const ext of extensions) {
				const plugin = pluginsByName.get(ext.pluginName);
				if (!plugin) {
					console.error(
						`Error: Plugin "${ext.pluginName}" not found in installed plugins.`,
					);
					console.error(
						`  Expected at: ${join(getAgentPluginsRoot(), "**", ext.pluginName)}`,
					);
					errorCount++;
					continue;
				}

				try {
					// Load base agent
					const baseAgent = await loadAgent(plugin, ext.agentName);

					// Merge
					const merged = mergeAgent(baseAgent, ext.extension);

					// Track rename
					if (merged.frontmatter.name !== baseAgent.frontmatter.name) {
						const pluginRenames = renamesByPlugin.get(ext.pluginName) ?? [];
						pluginRenames.push({
							from: baseAgent.frontmatter.name,
							to: merged.frontmatter.name,
						});
						renamesByPlugin.set(ext.pluginName, pluginRenames);
					}

					// Serialize
					let content = serializeAgentMd(merged);

					// AI edit pass (if configured)
					const editorInstructions = ext.extension["ai-editor-instructions"];
					if (editorInstructions) {
						const editorModel = ext.extension["ai-editor-model"] as
							| string
							| undefined;
						console.log(`    ⟳ Running AI edit (${editorModel ?? "gpt-5"})...`);
						content = await aiEdit(content, editorInstructions, editorModel);
					}

					// Write output
					const outputPath = join(outputDir, `${ext.agentName}.md`);
					await writeFile(outputPath, content, "utf-8");

					const relPath = relative(repoRoot, outputPath);
					console.log(
						`  ✓ ${relPath} (from ${ext.pluginName}/${ext.agentName})`,
					);
					successCount++;
				} catch (err) {
					console.error(
						`  ✗ ${ext.pluginName}/${ext.agentName}: ${(err as Error).message}`,
					);
					errorCount++;
				}
			}

			console.log(`\nDone: ${successCount} generated, ${errorCount} errors.`);

			// Write per-plugin apply snapshots
			const extendDir = getRepoExtendDir(repoRoot);
			for (const [pluginName, renames] of renamesByPlugin) {
				const snapshot = { renames };
				const snapshotPath = join(
					extendDir,
					pluginName,
					".apply-snapshot.json",
				);
				await writeFile(
					snapshotPath,
					JSON.stringify(snapshot, null, 4) + "\n",
					"utf-8",
				);
			}
		});

	return cmd;
}
