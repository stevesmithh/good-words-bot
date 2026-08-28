// Server-only helper for calling the Anthropic Claude API with tool use.
// All generation in this project runs through Anthropic (no Lovable AI credits).

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

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-5";

export async function callClaudeWithTool(
  prompt: string,
  tool: OpenAITool,
  options?: { temperature?: number; top_p?: number },
): Promise<AnthropicResult> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      error: "AI is not configured. Missing API key.",
    };
  }
  const model = process.env["ANTHROPIC_MODEL"] || DEFAULT_MODEL;

  const anthropicTool = {
    name: tool.function.name,
    description: tool.function.description,
    input_schema: tool.function.parameters,
  };

  // Try once with the requested settings; on a parse failure, retry once with
  // a lower temperature so the model produces more reliably-formatted tool args.
  const attempts: Array<{ temperature?: number; top_p?: number }> = [
    { temperature: options?.temperature, top_p: options?.top_p },
    { temperature: 0.3, top_p: 0.9 },
  ];

  let lastFailure: AnthropicResult | null = null;

  for (const attempt of attempts) {
    const resp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
        tools: [anthropicTool],
        tool_choice: { type: "tool", name: tool.function.name },
        // Anthropic rejects sending both temperature and top_p in some cases;
        // prefer temperature when provided.
        ...(attempt.temperature !== undefined
          ? { temperature: Math.min(attempt.temperature, 1) }
          : attempt.top_p !== undefined
            ? { top_p: attempt.top_p }
            : {}),
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
      if (resp.status === 400 && /credit|billing/i.test(errText)) {
        return {
          ok: false,
          status: 402,
          error: "AI credits finished. Please top up the API account.",
        };
      }
      if (resp.status === 401 || resp.status === 403) {
        return {
          ok: false,
          status: resp.status,
          error: "AI authentication failed. Check the API key.",
          details: errText,
        };
      }
      lastFailure = {
        ok: false,
        status: resp.status,
        error: `AI error ${resp.status}`,
        details: errText,
      };
      continue;
    }

    const data = (await resp.json()) as {
      content?: Array<{
        type?: string;
        name?: string;
        input?: Record<string, unknown>;
        text?: string;
      }>;
    };

    const call = data.content?.find(
      (b) => b.type === "tool_use" && b.name === tool.function.name,
    );

    if (call?.input && typeof call.input === "object") {
      return { ok: true, args: call.input };
    }

    const textBlock = data.content?.find((b) => b.type === "text")?.text ?? "";
    if (textBlock) {
      // Some responses fall back to plain text JSON — try to salvage it.
      try {
        const clean = textBlock.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean) as Record<string, unknown>;
        return { ok: true, args: parsed };
      } catch {
        /* fall through */
      }
    }

    lastFailure = {
      ok: false,
      status: 502,
      error: "Could not parse response",
      details: (textBlock || JSON.stringify(data)).slice(0, 500),
    };
  }

  return (
    lastFailure ?? {
      ok: false,
      status: 502,
      error: "AI did not return a usable response",
    }
  );
}
