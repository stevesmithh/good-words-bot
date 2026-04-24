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

  // The literal English word "code" is a US carrier spam trigger — always forbid it,
  // independent of category toggles. The code VALUE (e.g. WELCOME50) is still allowed.
  forbiddenSet.add("code");
  forbiddenSet.add("promo code");
  forbiddenSet.add("coupon code");
  forbiddenSet.add("use code");

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
      typeRules = `SMS type: Deposit coupon offer.
- MUST include the coupon value verbatim: ${input.couponCode}
- Mention it naturally, e.g. "use ${input.couponCode}", "with ${input.couponCode}", "try ${input.couponCode}", or just "${input.couponCode}".
- NEVER write the word "code" before or after it. Do NOT write "Code: ${input.couponCode}", "promo code ${input.couponCode}", or "use code ${input.couponCode}".
- Bonus description: ${input.bonusDescription || "(none)"}
- The user gets the bonus by depositing with this value.`;
      break;
    case "deposit_bonus":
      typeRules = `SMS type: ${input.depositOrdinal} deposit bonus.
- Mention this is for their ${input.depositOrdinal} deposit.
- Include the bonus value exactly as written: "${input.bonusAmount}"
${input.couponCode ? `- Include the coupon value verbatim: ${input.couponCode}. Mention it naturally, e.g. "use ${input.couponCode}" or "with ${input.couponCode}". NEVER write the word "code" before or after it.` : ""}`;
      break;
    case "signup_promo":
      typeRules = `SMS type: Signup promo offer.
- MUST include the promo value verbatim: ${input.promoCode}
- Mention it naturally at signup, e.g. "use ${input.promoCode} when you sign up", "sign up with ${input.promoCode}", "enter ${input.promoCode} on signup".
- NEVER write the word "code" before or after it. Do NOT write "promo code ${input.promoCode}" or "use code ${input.promoCode}".
- Reward on signup: ${input.freePlayReward || "free play"}`;
      break;
  }

  const lengthRule =
    input.lengthTarget === "short"
      ? "Message text MUST be under 160 characters TOTAL including the link. Aim for 10-15 words."
      : "Message text should be 10-15 words plus the link at the end. Total ideally under 200 characters.";

  return `You are writing bulk SMS for a US audience. The goal: messages that read like a real person texting a friend in everyday American English — casual, intriguing, and human — while passing US carrier spam filters (AT&T, Verizon, T-Mobile).

${brandLine}Audience: ${AUDIENCE_LABEL[input.audience]}
Tone: ${AUDIENCE_TONE[input.audience]}
Offer details: ${input.offerDetails}

${typeRules}

LENGTH: ${lengthRule}

VOICE — DAILY US TEXT MESSAGE:
- Write the way Americans actually text each other. Loose, casual, conversational.
- Use everyday spoken phrases: "hey", "btw", "ngl", "fyi", "heads up", "quick one", "sooo", "k so", "real quick", "just dropped", "saw this and thought of you", "thought you'd want to know", "okay this is actually pretty cool".
- Lowercase is fine and often better than perfect capitalization. Sentence fragments are fine.
- Light, natural punctuation only. A single "..." or "?" is great. No "!!!", no double punctuation, no emoji spam.
- One small emoji is OK if it fits naturally (👀 🎯 🤝 🎁 🍀). Never more than one. Often none is best.
- Curiosity hook over hard sell. Make them think "wait, what?" and tap the link to find out.
- Tease the value, don't shout it. Hint at the reward without sounding like an ad.
- Sound like a heads-up from a friend, not a brand announcement.

${
  input.ctaLink && input.ctaLink.trim()
    ? `LINK HANDLING:
- The CTA link is: ${input.ctaLink}
- Place the link at the very end of the message, preceded by exactly one space.
- No punctuation before or after the link.
- Do NOT rewrite, shorten, or modify the link — copy it exactly as given.
- Never use "click here", "click link", "tap here", "check this out and click", or any explicit click instruction. Let the link sit naturally at the end like a friend dropping a link in chat.`
    : `NO LINK:
- Do NOT include any URL or link in any variant.
- End each message naturally — a soft nudge or open-ended line is fine.
- Do NOT invent a placeholder link.`
}

FORBIDDEN WORDS (must not appear in any variant):
${forbiddenList}

SAFE REPLACEMENTS:
${replacementLines}

HARD RULES (apply to all six variants):
- Single short sentence, or two very short fragments. Max 15 words of text (link not counted).
- No ALL CAPS words. No "!!!". No "$$$". No "???". No repeated punctuation.
- No urgency pressure ("hurry", "last chance", "expires today", etc.).
- No marketing voice. No "exclusive", no "limited", no "amazing".
- No greetings like "Dear customer". No formal sign-offs.
${userCodes.length > 0 ? `- The user-provided code(s) ${userCodes.map((c) => `"${c}"`).join(", ")} MUST appear verbatim. They are ALWAYS allowed even if they resemble forbidden words. Mention them naturally, e.g. "use ${userCodes[0]}" or "code: ${userCodes[0]}" — not as a yelling promo banner.` : ""}

VARIANTS — return SIX messages, all conveying the same offer and code/value.

The first three are STANDARD style — clean, professional, brand-safe SMS copy. Polished but still natural. Proper sentence case. No slang, no abbreviations like "ngl"/"btw", no lowercase-only sentences. Think how a well-run marketing team would write it.
- "message" (primary standard): the cleanest, most balanced version. Clear value, friendly, professional.
- "standardA": informative angle. Lead with what they get. Direct and clear.
- "standardB": benefit-led angle. Lead with the outcome or feeling. Still polished.

The last three are CASUAL style — daily US text-message tone using the VOICE rules above (lowercase ok, slang ok, sentence fragments ok, curiosity hooks).
- "casualA": curiosity hook. Make them wonder what's behind the link without giving everything away. Something like "okay this is actually pretty wild...", "you're gonna want to see this", "saw this and thought of you", "ngl this looks legit".
- "casualB": friend-recommendation style. Reads like a buddy forwarding something. Something like "heads up — this one's worth a look", "thought you'd want to know about this", "btw this just dropped".
- "casualC": casual heads-up / FYI style. Short, low-key, like a quick text from a friend. Something like "fyi this is live now", "quick one for you", "real quick — saw this for you", "k so this just popped up".

Rules for ALL five variants:
- Same offer. Same code/value if applicable.
- Noticeably different wording, sentence shape, and opener so carriers don't dedupe on bulk send.
- Every variant must follow ALL rules above and end with the link.

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
          if (body.ctaLink && body.ctaLink.trim()) {
            try {
              new URL(body.ctaLink);
            } catch {
              return Response.json({ error: "CTA link must be a valid URL." }, { status: 400 });
            }
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
                    description: "Return six SMS variants: 3 standard + 3 casual.",
                    parameters: {
                      type: "object",
                      properties: {
                        message: {
                          type: "string",
                          description:
                            "Primary STANDARD SMS — clean, polished, professional. Link at end.",
                        },
                        standardA: {
                          type: "string",
                          description:
                            "Standard variant A — informative angle, leads with what they get. Polished tone. Link at end.",
                        },
                        standardB: {
                          type: "string",
                          description:
                            "Standard variant B — benefit-led angle, leads with outcome. Polished tone. Link at end.",
                        },
                        casualA: {
                          type: "string",
                          description:
                            "Casual variant A — daily US text style, curiosity hook. Lowercase / slang allowed. Link at end.",
                        },
                        casualB: {
                          type: "string",
                          description:
                            "Casual variant B — daily US text style, friend-recommendation tone. Lowercase / slang allowed. Link at end.",
                        },
                        casualC: {
                          type: "string",
                          description:
                            "Casual variant C — daily US text style, low-key heads-up / FYI tone. Lowercase / slang allowed. Link at end.",
                        },
                      },
                      required: ["message", "standardA", "standardB", "casualA", "casualB", "casualC"],
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

          let parsed: {
            message: string;
            standardA: string;
            standardB: string;
            casualA: string;
            casualB: string;
            casualC: string;
          };
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
