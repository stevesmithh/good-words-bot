import { createFileRoute } from "@tanstack/react-router";
import {
  SMS_SPAM_CATEGORIES,
  SMS_SAFE_REPLACEMENTS,
  type SmsSpamCategoryId,
} from "@/lib/sms-spam-words";

type Audience = "new" | "active" | "inactive";
type SmsType = "promotional" | "deposit_coupon" | "deposit_bonus" | "signup_promo";
type LengthTarget = "short" | "standard";

const AUDIENCE_LABEL: Record<Audience, string> = {
  new: "New users",
  active: "Active users",
  inactive: "Inactive users",
};

const AUDIENCE_TONE: Record<Audience, string> = {
  new: "Warm and welcoming. They just joined.",
  active: "Friendly, value-focused. Keep them engaged.",
  inactive: "Gentle, low-pressure. A soft nudge to come back.",
};

type SmsBody = {
  smsType: SmsType;
  offerDetails: string;
  audience: Audience;
  brandName?: string;
  ctaLink: string;
  lengthTarget: LengthTarget;
  couponCode?: string;
  promoCode?: string;
  bonusDescription?: string;
  depositOrdinal?: "1st" | "2nd" | "3rd";
  bonusAmount?: string;
  freePlayReward?: string;
  extraForbidden?: string;
  activeCategories: SmsSpamCategoryId[];
};

function buildPrompt(input: SmsBody) {
  const forbiddenSet = new Set<string>();
  for (const cat of SMS_SPAM_CATEGORIES) {
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

  // User-provided codes are always safe — remove them from forbidden set
  const userCodes = [input.couponCode, input.promoCode].filter(Boolean) as string[];
  for (const code of userCodes) {
    forbiddenSet.delete(code.toLowerCase());
  }

  const forbiddenList = Array.from(forbiddenSet).join(", ");
  const replacementLines = Object.entries(SMS_SAFE_REPLACEMENTS)
    .map(([from, to]) => `- "${from}" → "${to}"`)
    .join("\n");

  const brandLine = input.brandName ? `Brand: ${input.brandName}\n` : "";

  let typeRules = "";
  switch (input.smsType) {
    case "promotional":
      typeRules = `SMS type: Promotional message. Just describe the offer briefly.`;
      break;
    case "deposit_coupon":
      typeRules = `SMS type: Deposit coupon code.
- MUST include the coupon code verbatim: "${input.couponCode}"
- Format it clearly, e.g. "Code: ${input.couponCode}".
- Bonus description: ${input.bonusDescription || "(none)"}
- The user gets the bonus by depositing with this code.`;
      break;
    case "deposit_bonus":
      typeRules = `SMS type: ${input.depositOrdinal} deposit bonus.
- Mention this is for their ${input.depositOrdinal} deposit.
- Include the bonus value exactly as written: "${input.bonusAmount}"
${input.couponCode ? `- Include the coupon code verbatim: "Code: ${input.couponCode}"` : ""}`;
      break;
    case "signup_promo":
      typeRules = `SMS type: Signup promo code.
- MUST include the promo code verbatim: "${input.promoCode}"
- Format it clearly, e.g. "Code: ${input.promoCode}".
- Reward on signup: ${input.freePlayReward || "free play"}
- Tell them to use the code when signing up.`;
      break;
  }

  const lengthRule =
    input.lengthTarget === "short"
      ? "Message text MUST be under 160 characters TOTAL including the link. Aim for 10-15 words."
      : "Message text should be 10-15 words plus the link at the end. Total ideally under 200 characters.";

  return `You are an SMS copywriter for bulk US carrier SMS sending. Write a short, human, deliverable text message that avoids US carrier spam filters (AT&T, Verizon, T-Mobile).

${brandLine}Audience: ${AUDIENCE_LABEL[input.audience]}
Tone: ${AUDIENCE_TONE[input.audience]}
Offer details: ${input.offerDetails}

${typeRules}

LENGTH: ${lengthRule}

LINK HANDLING:
- The CTA link is: ${input.ctaLink}
- Place the link at the very end of the message, preceded by exactly one space.
- Do NOT add punctuation after the link.
- Do NOT rewrite, shorten, or modify the link in any way — copy it exactly.
- Do NOT use phrases like "click here", "click link", "tap here". Just let the link speak for itself.

FORBIDDEN WORDS (do not use any of these):
${forbiddenList}

SAFE REPLACEMENTS:
${replacementLines}

WRITING RULES:
- Sound like a real person texting, not a marketer.
- Single sentence or two very short ones.
- No ALL CAPS words. No "!!!". No "$$$". No repeated punctuation.
- No urgency pressure. No "free". No "click here".
- Plain everyday language.
${userCodes.length > 0 ? `- The user-provided code(s) ${userCodes.map((c) => `"${c}"`).join(", ")} MUST appear verbatim — they are ALWAYS allowed even if they look like forbidden words.` : ""}

VARIANTS:
- Return THREE different phrasings of the same message: "message" (primary), "variantA", "variantB".
- Each variant must convey the same offer and include the same code/value if applicable.
- Use noticeably different wording in each so carriers don't dedupe them on bulk send.
- Each variant must follow ALL the rules above and include the link at the end.

Return your answer using the provided tool.`;
}

export const Route = createFileRoute("/api/generate-sms")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as SmsBody;

          if (!body.offerDetails || !body.offerDetails.trim()) {
            return Response.json({ error: "Offer details are required." }, { status: 400 });
          }
          if (!body.ctaLink || !body.ctaLink.trim()) {
            return Response.json({ error: "CTA link is required." }, { status: 400 });
          }
          try {
            new URL(body.ctaLink);
          } catch {
            return Response.json({ error: "CTA link must be a valid URL." }, { status: 400 });
          }
          if (body.smsType === "deposit_coupon" && !body.couponCode?.trim()) {
            return Response.json({ error: "Coupon code is required." }, { status: 400 });
          }
          if (body.smsType === "signup_promo" && !body.promoCode?.trim()) {
            return Response.json({ error: "Promo code is required." }, { status: 400 });
          }
          if (body.smsType === "deposit_bonus") {
            if (!body.depositOrdinal) {
              return Response.json({ error: "Deposit ordinal is required." }, { status: 400 });
            }
            if (!body.bonusAmount?.trim()) {
              return Response.json({ error: "Bonus amount is required." }, { status: 400 });
            }
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
                    name: "return_sms",
                    description: "Return the generated SMS message and two variants.",
                    parameters: {
                      type: "object",
                      properties: {
                        message: {
                          type: "string",
                          description:
                            "Primary SMS message including the link at the end. Must follow all rules.",
                        },
                        variantA: {
                          type: "string",
                          description:
                            "First alternate phrasing of the same SMS. Same offer, different wording, link at end.",
                        },
                        variantB: {
                          type: "string",
                          description:
                            "Second alternate phrasing of the same SMS. Same offer, different wording, link at end.",
                        },
                      },
                      required: ["message", "variantA", "variantB"],
                      additionalProperties: false,
                    },
                  },
                },
              ],
              tool_choice: { type: "function", function: { name: "return_sms" } },
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

          let parsed: { message: string; variantA: string; variantB: string };
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
