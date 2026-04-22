import { createFileRoute } from "@tanstack/react-router";
import { SPAM_CATEGORIES, SAFE_REPLACEMENTS, type SpamCategoryId } from "@/lib/spam-words";

type Audience = "new" | "active" | "inactive";

const AUDIENCE_LABEL: Record<Audience, string> = {
  new: "New users",
  active: "Active users",
  inactive: "Inactive users",
};

const AUDIENCE_TONE: Record<Audience, string> = {
  new: "Warm, welcoming, gently encouraging. This person just joined — make them feel at home.",
  active:
    "Friendly and value-focused. Highlight what they gain. Keep them engaged without overselling.",
  inactive:
    "Gentle and low-pressure. No guilt, no drama. A warm nudge to come back and see what is new.",
};

function buildPrompt(input: {
  offerDetails: string;
  audience: Audience;
  brandName?: string;
  extraForbidden?: string;
  activeCategories: SpamCategoryId[];
}) {
  const forbiddenSet = new Set<string>();
  for (const cat of SPAM_CATEGORIES) {
    if (input.activeCategories.includes(cat.id)) {
      cat.words.forEach((w) => forbiddenSet.add(w));
    }
  }
  if (input.extraForbidden) {
    input.extraForbidden
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean)
      .forEach((w) => forbiddenSet.add(w));
  }
  const forbiddenList = Array.from(forbiddenSet).join(", ");
  const replacementLines = Object.entries(SAFE_REPLACEMENTS)
    .map(([from, to]) => `- Instead of "${from}" → use "${to}"`)
    .join("\n");

  const brandLine = input.brandName ? `Brand: ${input.brandName}\n` : "";

  return `You are an expert email copywriter focused on inbox deliverability. Write a short, friendly promotional email that reaches the primary inbox — not spam, not promotions tab.

${brandLine}Audience: ${AUDIENCE_LABEL[input.audience]}
Tone: ${AUDIENCE_TONE[input.audience]}
Offer: ${input.offerDetails}

REWARD EXTRACTION RULES:
- Read all rewards in the offer carefully.
- Group them by type: free play, discount, XP, free spins, cash, bonus, etc.
- For each type, use the highest value exactly as written in the offer — do not round, do not paraphrase numbers.
- List every reward type in the email body on its own short line.
- Do not skip any reward category.

FORBIDDEN WORDS (do not use any of these — replace with the safe alternatives below):
${forbiddenList}

SAFE REPLACEMENTS:
${replacementLines}

WRITING RULES:
- Write like a real person talking to a friend. Not a salesperson.
- Every sentence must be 20 words or fewer.
- Use only simple, everyday words.
- No hype, no big promises, no caps lock, no exclamation marks.
- Do not start sentences with "I" or "We" — keep focus on the reader ("you" / "your").
- Vary sentence length. Short is fine.
- No urgency pressure language.

DELIVERABILITY RULES:
- Subject line: MUST start with exactly one emoji that visually relates to the offer (e.g. 🎁 for gifts, 🎰 for spins, 💸 for cash back, 🎯 for targeted offers, ☕ for casual, 🌟 for rewards). Pick the single most relevant emoji — never more than one, never generic ones like 😀. Follow the emoji with one space, then the subject text. Total length under 50 characters including the emoji. Personal curious tone, no "free" as first word, no exclamation marks, no all-caps, must not sound like an ad.
- Preview text: adds new context not in subject, under 90 characters, no pressure language.
- Header: 3–7 words, warm and plain.
- Body: 5–8 sentences. Start with warm opener for the audience. Then list each reward on its own line. End with one soft, low-pressure call to action — no "click here", no "buy now".

Return the email using the provided tool.`;
}

export const Route = createFileRoute("/api/generate-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            offerDetails: string;
            audience: Audience;
            brandName?: string;
            extraForbidden?: string;
            activeCategories: SpamCategoryId[];
          };

          if (!body.offerDetails || !body.offerDetails.trim()) {
            return Response.json({ error: "Offer details are required." }, { status: 400 });
          }

          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) {
            return Response.json(
              { error: "AI is not configured. LOVABLE_API_KEY missing." },
              { status: 500 },
            );
          }

          const prompt = buildPrompt(body);

          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [{ role: "user", content: prompt }],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "return_email",
                    description: "Return the generated email in structured form.",
                    parameters: {
                      type: "object",
                      properties: {
                        subject: { type: "string", description: "Subject line starting with exactly one relevant emoji + space + text. Under 50 chars total." },
                        preview: { type: "string", description: "Preview text, under 90 chars." },
                        header: { type: "string", description: "Email header, 3-7 words." },
                        body: { type: "string", description: "Email body, 5-8 sentences." },
                      },
                      required: ["subject", "preview", "header", "body"],
                      additionalProperties: false,
                    },
                  },
                },
              ],
              tool_choice: { type: "function", function: { name: "return_email" } },
            }),
          });

          if (!aiResp.ok) {
            const errText = await aiResp.text().catch(() => "");
            if (aiResp.status === 429) {
              return Response.json(
                { error: "Rate limit reached. Please wait a moment and try again." },
                { status: 429 },
              );
            }
            if (aiResp.status === 402) {
              return Response.json(
                {
                  error:
                    "AI credits exhausted. Add credits to your Lovable workspace under Settings → Workspace → Usage.",
                },
                { status: 402 },
              );
            }
            return Response.json(
              { error: `AI gateway error ${aiResp.status}`, details: errText },
              { status: aiResp.status },
            );
          }

          const data = (await aiResp.json()) as {
            choices?: Array<{
              message?: {
                content?: string | null;
                tool_calls?: Array<{
                  function?: { name?: string; arguments?: string };
                }>;
              };
            }>;
          };

          const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
          const argsStr = toolCall?.function?.arguments;

          if (!argsStr) {
            const raw = data.choices?.[0]?.message?.content ?? "";
            return Response.json(
              { error: "Could not parse response", raw: raw || JSON.stringify(data) },
              { status: 502 },
            );
          }

          let parsed: { subject: string; preview: string; header: string; body: string };
          try {
            parsed = JSON.parse(argsStr);
          } catch {
            return Response.json(
              { error: "Could not parse response", raw: argsStr },
              { status: 502 },
            );
          }

          return Response.json(parsed);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
