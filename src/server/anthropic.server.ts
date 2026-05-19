// Server-only helper for calling the Lovable AI Gateway (Gemini) with tool use.
// Function name kept as `callClaudeWithTool` for backward compatibility with
// existing route imports — under the hood it now uses Lovable AI / Gemini.

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

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-pro";

export async function callClaudeWithTool(
  prompt: string,
  tool: OpenAITool,
): Promise<AnthropicResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      error: "AI is not configured. LOVABLE_API_KEY missing.",
    };
  }

  const resp = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      tools: [tool],
      tool_choice: { type: "function", function: { name: tool.function.name } },
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
    if (resp.status === 402) {
      return {
        ok: false,
        status: 402,
        error: "AI credits finished. Please top up your workspace.",
      };
    }
    if (resp.status === 401 || resp.status === 403) {
      return {
        ok: false,
        status: resp.status,
        error: "AI authentication failed.",
        details: errText,
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
    choices?: Array<{
      message?: {
        tool_calls?: Array<{
          function?: { name?: string; arguments?: string };
        }>;
        content?: string;
      };
    }>;
  };

  const call = data.choices?.[0]?.message?.tool_calls?.find(
    (c) => c.function?.name === tool.function.name,
  );
  const argsStr = call?.function?.arguments;

  if (!argsStr) {
    return {
      ok: false,
      status: 502,
      error: "Could not parse response",
      details: data.choices?.[0]?.message?.content ?? JSON.stringify(data),
    };
  }

  try {
    const parsed = JSON.parse(argsStr) as Record<string, unknown>;
    return { ok: true, args: parsed };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "Could not parse tool arguments",
      details: argsStr,
    };
  }
}
