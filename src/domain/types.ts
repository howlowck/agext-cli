/** Parsed plugin.json metadata */
export interface PluginMeta {
	/** Plugin display name from plugin.json */
	name: string;
	/** Absolute path to the plugin root directory */
	rootPath: string;
	/** Relative path to agents directory (from plugin.json "agents" field) */
	agentsDir: string;
	/** Original plugin.json content */
	raw: Record<string, unknown>;
}

/** Parsed YAML frontmatter from an .agent.md file */
export interface AgentFrontmatter {
	name: string;
	description?: string;
	"argument-hint"?: string;
	tools?: string[];
	agents?: string[];
	model?: string[];
	[key: string]: unknown;
}

/** A fully parsed agent document */
export interface AgentDocument {
	/** The agent file name (without extension) */
	fileName: string;
	/** Parsed YAML frontmatter */
	frontmatter: AgentFrontmatter;
	/** Markdown body (everything after the frontmatter) */
	body: string;
}

/** Extension YAML schema for .extend.yaml files */
export interface AgentExtension {
	/** Optional name suffix override (defaults to " - Repo Extended") */
	"name-suffix"?: string;
	/** Frontmatter field overrides (replacement semantics) */
	description?: string;
	/** Additional tools to merge (additive — union with base) */
	tools?: string[];
	/** Additional agents to merge (additive — union with base) */
	agents?: string[];
	/** Model override (replacement semantics) */
	model?: string[];
	/** Instructions prepended before the agent body */
	"prepend-instructions"?: string;
	/** Instructions appended after the agent body */
	"append-instructions"?: string;
	/** AI editor instructions — if set, runs an AI edit pass after merge */
	"ai-editor-instructions"?: string;
	/** Model to use for the AI edit pass (e.g. "gpt-5", "claude-sonnet-4.5") */
	"ai-editor-model"?: string;
	/** Any other frontmatter overrides */
	[key: string]: unknown;
}

/** Resolved extension mapping */
export interface ResolvedExtension {
		/** Plugin name (directory name under .agext/extend/) */
		pluginName: string;
		/** Agent file name (without .extend.yaml suffix) */
		agentName: string;
		/** Parsed extension data */
		extension: AgentExtension;
		/** Absolute path to the .extend.yaml file */
		extensionPath: string;
	}
