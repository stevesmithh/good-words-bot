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
- Preview text: SHORT — strictly under 50 characters. Aim for 30–45 characters. One short phrase that adds new context not in the subject. No pressure language, no punctuation pile-ups, no emojis.
- Header: 3–7 words, warm and plain.
- Body: structured as 2–3 short paragraphs separated by a blank line (\n\n). Sentences inside a paragraph flow naturally on the same line — do NOT put every sentence on its own line. Structure:
  1. Opening paragraph (1–3 sentences): warm opener tailored to the audience, leading into why you are writing. Sentences flow together in the same paragraph.
  2. Rewards block: one short intro line, then each reward on its own line as a compact list (this is the ONLY place line breaks per item are allowed). Format each reward line as "Label: value" (e.g. "Goldmine Rewards: up to $300 weekly").
  3. Closing paragraph (1–2 sentences): a soft, low-pressure nudge about where to find it or how to use it. No "click here", no "buy now". Sentences flow on the same line.
- Use \n\n between paragraphs (blank line) and single \n only between reward items inside the rewards block.
- Never start every sentence on a new line. Outside the rewards block, sentences should sit next to each other within a paragraph like a normal human email.
- CTA button: 2–4 words, plain and friendly, action-oriented but never pushy. Title Case. No emojis, no exclamation marks, no all-caps. AVOID spammy CTA words like: "Buy Now", "Click Here", "Act Now", "Order Now", "Shop Now", "Claim Now", "Sign Up Now", "Free", "Limited Time", "Don't Miss". PREFER soft, safe phrasings like: "See Details", "Take a Look", "View Your Offer", "Open Your Rewards", "Check It Out", "Explore Rewards", "See What's Inside", "Visit Your Account".

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

          // Length caps to prevent oversized prompt abuse
          if (body.offerDetails.length > 2000) {
            return Response.json({ error: "Offer details must be 2000 chars or less." }, { status: 400 });
          }
          if (
            (body.brandName && body.brandName.length > 200) ||
            (body.extraForbidden && body.extraForbidden.length > 1000)
          ) {
            return Response.json({ error: "One or more fields exceed the allowed length." }, { status: 400 });
          }
          if (Array.isArray(body.activeCategories) && body.activeCategories.length > 50) {
            return Response.json({ error: "Too many categories." }, { status: 400 });
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
                        body: { type: "string", description: "Email body as 2-3 short paragraphs separated by a blank line (\\n\\n). Sentences inside a paragraph flow on the same line — do not break every sentence onto its own line. The rewards block is the only place where individual items go on their own lines (separated by single \\n)." },
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

          // Normalize escaped newlines/tabs that some models emit as literal "\n" text
          const normalizeNewlines = (s: string) =>
            s
              .replace(/\\r\\n/g, "\n")
              .replace(/\\n/g, "\n")
              .replace(/\\t/g, "\t");

          parsed = {
            subject: parsed.subject,
            preview: parsed.preview,
            header: parsed.header,
            body: normalizeNewlines(parsed.body),
          };

          return Response.json(parsed);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
