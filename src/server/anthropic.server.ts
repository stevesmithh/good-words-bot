// Server-only helper for AI generation via the Lovable AI Gateway.
// All generation in this project runs through Lovable AI (no external API key needed).

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

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

export async function callClaudeWithTool(
  prompt: string,
  tool: OpenAITool,
  options?: { temperature?: number; top_p?: number },
): Promise<AnthropicResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      error: "AI is not configured. Missing API key.",
    };
  }
  const model = process.env["AI_MODEL"] || DEFAULT_MODEL;

  const baseTemperature = options?.temperature ?? 0.45;

  // Try once with the requested settings; on a parse failure, retry once with
  // a lower temperature so the model produces more reliably-formatted tool args.
  const attempts: Array<{ temperature: number }> = [
    { temperature: Math.min(baseTemperature, 1) },
    { temperature: 0.25 },
  ];

  let lastFailure: AnthropicResult | null = null;

  for (const attempt of attempts) {
    const resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a precise marketing copywriter. Follow every instruction in the user message literally, especially word limits, tone rules, forbidden words, and the rule to never invent details that are not in the provided offer. Always answer by calling the provided tool with complete field values.",
          },
          { role: "user", content: prompt },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: tool.function.name } },
        temperature: attempt.temperature,
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
      if (resp.status === 402 || (resp.status === 400 && /credit|billing/i.test(errText))) {
        return {
          ok: false,
          status: 402,
          error: "AI credits finished. Please top up to continue.",
        };
      }
      if (resp.status === 401 || resp.status === 403) {
        console.error("[ai-gateway] auth rejected", resp.status, errText.slice(0, 300));
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
      choices?: Array<{
        message?: {
          tool_calls?: Array<{
            function?: { name?: string; arguments?: string };
          }>;
          content?: string | null;
        };
      }>;
    };

    const message = data.choices?.[0]?.message;
    const toolCall = message?.tool_calls?.find(
      (c) => c.function?.name === tool.function.name,
    );

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        return { ok: true, args: parsed };
      } catch {
        /* fall through to text salvage */
      }
    }

    const textBlock = message?.content ?? "";
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
