import { Command } from "commander";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { discoverPlugins } from "../services/plugin-discovery.js";
import { listAgents, loadAgent } from "../services/agent-loader.js";
import { generateExtendTemplate } from "../services/template-writer.js";
import { getRepoExtendPluginDir, EXTEND_YAML_SUFFIX } from "../domain/paths.js";

export function scaffoldCommand(): Command {
	const cmd = new Command("scaffold")
		.description(
			"Scaffold a new .extend.yaml file from an installed agent plugin",
		)
		.action(async () => {
			// 1. Discover plugins
			const plugins = await discoverPlugins();
			if (plugins.length === 0) {
				console.error(
					"No agent plugins found in ~/.vscode/agent-plugins/\n" +
						"Install an agent plugin first.",
				);
				process.exit(1);
			}

			// 2. Select plugin
			console.log("\nInstalled agent plugins:\n");
			plugins.forEach((p, i) => {
				console.log(`  ${i + 1}. ${p.name} (${p.rootPath})`);
			});

			const pluginIdx = await promptNumber(
				`\nSelect a plugin (1-${plugins.length}): `,
				1,
				plugins.length,
			);
			const plugin = plugins[pluginIdx - 1];

			// 3. List agents
			const agentNames = await listAgents(plugin);
			if (agentNames.length === 0) {
				console.error(`No agents found in plugin "${plugin.name}".`);
				process.exit(1);
			}

			console.log(`\nAgents in "${plugin.name}":\n`);
			agentNames.forEach((name, i) => {
				console.log(`  ${i + 1}. ${name}`);
			});

			const agentIdx = await promptNumber(
				`\nSelect an agent to extend (1-${agentNames.length}): `,
				1,
				agentNames.length,
			);
			const agentName = agentNames[agentIdx - 1];

			// 4. Load agent and generate template
			const agent = await loadAgent(plugin, agentName);
			const template = generateExtendTemplate(agent);

			// 5. Write extend file
			const repoRoot = process.cwd();
			const extendDir = getRepoExtendPluginDir(repoRoot, plugin.name);
			await mkdir(extendDir, { recursive: true });

			const extendPath = join(extendDir, `${agentName}${EXTEND_YAML_SUFFIX}`);

			if (existsSync(extendPath)) {
				const overwrite = await promptConfirm(
					`\n${extendPath} already exists. Overwrite? (y/N): `,
				);
				if (!overwrite) {
					console.log("Aborted.");
					return;
				}
			}

			await writeFile(extendPath, template, "utf-8");
			console.log(`\nCreated: ${extendPath}`);
			console.log("Edit the file to customize your agent extension, then run:");
			console.log("  agext apply");
		});

	return cmd;
}

/** Simple line prompt that reads from stdin */
async function promptLine(message: string): Promise<string> {
	const { createInterface } = await import("readline");
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((resolve) => {
		rl.question(message, (answer) => {
			rl.close();
			resolve(answer.trim());
		});
	});
}

async function promptNumber(
	message: string,
	min: number,
	max: number,
): Promise<number> {
	while (true) {
		const input = await promptLine(message);
		const num = parseInt(input, 10);
		if (!isNaN(num) && num >= min && num <= max) {
			return num;
		}
		console.log(`Please enter a number between ${min} and ${max}.`);
	}
}

async function promptConfirm(message: string): Promise<boolean> {
	const input = await promptLine(message);
	return input.toLowerCase() === "y" || input.toLowerCase() === "yes";
}
