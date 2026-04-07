import { CopilotClient, approveAll } from "@github/copilot-sdk";

/**
 * Run an AI edit pass on the merged agent content using the GitHub Copilot SDK.
 *
 * @param content - The serialized agent markdown to edit
 * @param instructions - Instructions for the AI editor describing what to change
 * @param model - Model to use (e.g. "gpt-5", "claude-sonnet-4.5")
 * @returns The AI-edited content
 */
export async function aiEdit(
	content: string,
	instructions: string,
	model?: string,
): Promise<string> {
	const client = new CopilotClient();
	try {
		await client.start();

		const session = await client.createSession({
			model: model ?? "gpt-5",
			onPermissionRequest: approveAll,
			systemMessage: {
				mode: "replace",
				content: [
					"You are an agent definition editor. You receive an agent definition file (YAML frontmatter + markdown body).",
					"Apply the user's editing instructions to the content.",
					"Output ONLY the complete edited agent definition — no explanations, no code fences, no commentary.",
					"Preserve the --- delimited YAML frontmatter structure.",
					"",
					"Editing instructions:",
					instructions,
				].join("\n"),
			},
		});

		const response = await session.sendAndWait({
			prompt: content,
		});

		await session.disconnect();

		if (!response?.data?.content) {
			throw new Error("AI editor returned no content");
		}

		return response.data.content;
	} finally {
		await client.stop();
	}
}
