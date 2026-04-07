# agext-cli

CLI tool to extend VS Code Copilot agent plugins with repo-specific overrides.

## Why?

VS Code installs agent plugins in a user-level directory, and adding any customization means modifying the external source directory and these changes are overwritten by any future updates.

`agext-cli` lets you layer repo-specific overrides on top of any installed agent plugin — without forking or modifying the originals — so every agent behaves exactly the way your project needs.

## Features

- **Scaffold** — Interactively generate a `.extend.yaml` override file from any installed agent plugin
- **Apply** — Merge all `.extend.yaml` overrides with base agents and write repo-local `.md` agent files
- **Subagent Remap** — Automatically update subagent and handoff references when extended agents are renamed, creating or editing `.extend.yaml` files as needed
- **Additive merge** — Tools and agents lists are unioned (no duplicates); descriptions and models are replaced
- **Prepend / append instructions** — Inject repo-specific markdown before or after the agent body
- **AI editor pass** — Optionally rewrite the merged output with a Copilot SDK model
- **Cycle detection** — Warns about circular subagent references during remap

## Install

Requires [Node.js](https://nodejs.org) >= 18.

You can install the global cli `agext`

```bash
npm install -g agext-cli
agext -h
```

or run directly with `npx`.

```bash
npx agext-cli
```

## Usage

### `agext scaffold`

Interactively create a `.extend.yaml` file from an installed agent plugin:

```bash
agext scaffold
```

1. Lists installed plugins from `~/.vscode/agent-plugins/`
2. Select a plugin, then an agent
3. Generates `.agext/extend/{plugin-name}/agents/{agent-name}.extend.yaml`

### `agext apply`

Apply all extensions to generate repo-local agent files:

```bash
agext apply
```

Scans `.agext/extend/` for `.extend.yaml` files, merges each with its base agent, and writes the result to `.github/agents/{agent-name}.md`.

### `agext remap`

Update subagent references across `.extend.yaml` files after agents are renamed:

```bash
agext remap
```

1. Reads existing `.extend.yaml` files to determine agent renames (via `name-suffix`)
2. Builds a dependency map of subagent and handoff references for each plugin
3. Detects and reports circular references
4. Creates or updates `.extend.yaml` files to remap subagent/handoff names so they point to the renamed agents

Run `agext apply` afterwards to regenerate the agent files.

## Extension YAML format

```yaml
# Suffix appended to the agent name (default: " - Repo Extended")
name-suffix: " - Repo Extended"

# Replaces the base agent description
description: "Custom description"

# Additional tools (merged with base, no duplicates)
tools:
  - browser

# Additional agents (merged with base, no duplicates)
agents:
  - MyCustomAgent

# Replaces the base agent model
model:
  - Claude Sonnet
  - claude-sonnet

# Markdown inserted before the agent body
prepend-instructions: |
  Setup instructions here.

# Markdown inserted after the agent body
append-instructions: |
  Your repo-specific instructions here.

# Optional: AI edit pass after merge (uses GitHub Copilot SDK)
# ai-editor-instructions: |
#   Rewrite the identity section to be more concise.
# ai-editor-model: gpt-5
```

### Merge rules

| Field | Behavior |
|---|---|
| `tools`, `agents` | Additive (union, no duplicates) |
| `description`, `model` | Replacement |
| `prepend-instructions` | Inserted before agent body |
| `append-instructions` | Inserted after agent body |
| `ai-editor-instructions` | AI edit pass on final content (Copilot SDK) |
| `ai-editor-model` | Model for AI edit (default: `gpt-5`) |
| `name-suffix` | Appended to agent name |

## Development

```bash
npm run dev -- scaffold   # run without compiling
npm test                  # run tests
npm run build             # compile TypeScript to dist/
```
