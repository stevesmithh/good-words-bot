// Server-only helper for calling Anthropic Claude with tool use.
// Takes an OpenAI-style tool definition and returns the parsed tool input.

export type OpenAITool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type AnthropicResult =
  | { ok: true; args: Record<string, unknown> }
  | { ok: false; status: number; error: string; details?: string };

const ANTHROPIC_MODEL = "claude-sonnet-4-5";

export async function callClaudeWithTool(
  prompt: string,
  tool: OpenAITool,
): Promise<AnthropicResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      error: "AI is not configured. ANTHROPIC_API_KEY missing.",
    };
  }

  const anthropicTool = {
    name: tool.function.name,
    description: tool.function.description,
    input_schema: tool.function.parameters,
  };

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      tools: [anthropicTool],
      tool_choice: { type: "tool", name: tool.function.name },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    if (resp.status === 429) {
      return {
        ok: false,
        status: 429,
        error: "Rate limit reached. Please wait a moment and try again.",
      };
    }
    if (resp.status === 401 || resp.status === 403) {
      return {
        ok: false,
        status: resp.status,
        error: "AI authentication failed. Please check the API key.",
      };
    }
    if (resp.status === 402 || /credit|balance|quota/i.test(errText)) {
      return {
        ok: false,
        status: 402,
        error: "AI credits finished. Please try again later.",
      };
    }
    return {
      ok: false,
      status: resp.status,
      error: `AI error ${resp.status}`,
      details: errText,
    };
  }

  const data = (await resp.json()) as {
    content?: Array<{
      type: string;
      name?: string;
      input?: Record<string, unknown>;
      text?: string;
    }>;
  };

  const toolUse = data.content?.find(
    (b) => b.type === "tool_use" && b.name === tool.function.name,
  );

  if (!toolUse || !toolUse.input) {
    const raw =
      data.content?.find((b) => b.type === "text")?.text ?? JSON.stringify(data);
    return {
      ok: false,
      status: 502,
      error: "Could not parse response",
      details: raw,
    };
  }

  return { ok: true, args: toolUse.input };
}
