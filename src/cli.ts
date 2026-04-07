import { Command } from "commander";
import { scaffoldCommand } from "./commands/scaffold.js";
import { applyCommand } from "./commands/apply.js";
import { remapCommand } from "./commands/remap.js";

export function createCli(): Command {
	const program = new Command();

	program
		.name("agext")
		.description(
			"Extend VS Code Copilot agent plugins with repo-specific overrides",
		)
		.version("0.1.0");

	program.addCommand(scaffoldCommand());
	program.addCommand(applyCommand());
	program.addCommand(remapCommand());

	return program;
}
