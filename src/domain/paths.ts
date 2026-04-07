import { join } from "path";
import { homedir } from "os";

/** Default name suffix appended to extended agents */
export const DEFAULT_NAME_SUFFIX = " - Repo Extended";

/** Extension file pattern */
export const EXTEND_YAML_SUFFIX = ".extend.yaml";

/** Agent file suffix in plugins */
export const AGENT_MD_SUFFIX = ".agent.md";

/** Root directory for VS Code agent plugins */
export function getAgentPluginsRoot(): string {
	return join(homedir(), ".vscode", "agent-plugins");
}

/** Resolve root path for a specific plugin by its directory name segments */
export function getPluginRoot(pluginDirName: string): string {
	return join(getAgentPluginsRoot(), pluginDirName);
}

/** Repo-local extend directory */
export function getRepoExtendDir(repoRoot: string): string {
	return join(repoRoot, ".agext", "extend");
}

/** Repo-local extend directory for a specific plugin */
export function getRepoExtendPluginDir(
	repoRoot: string,
	pluginName: string,
): string {
	return join(getRepoExtendDir(repoRoot), pluginName, "agents");
}

/** Repo-local output agents directory */
export function getRepoAgentsDir(repoRoot: string): string {
	return join(repoRoot, ".github", "agents");
}
