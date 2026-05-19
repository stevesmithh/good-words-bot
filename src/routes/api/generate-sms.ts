import { createFileRoute } from "@tanstack/react-router";
import { callClaudeWithTool } from "@/server/anthropic.server";
import {
  SMS_SPAM_CATEGORIES,
  SMS_SAFE_REPLACEMENTS,
  type SmsSpamCategoryId,
} from "@/lib/sms-spam-words";

type Audience = "new" | "active" | "inactive";
type SmsType = "promotional" | "deposit_coupon" | "deposit_bonus" | "signup_promo" | "non_spam";
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
    case "non_spam":
      typeRules = `SMS type: NON-SPAM transactional account notification.
- MUST include the promo value verbatim: ${input.promoCode}
- Reference it neutrally, e.g. "apply ${input.promoCode}", "use ${input.promoCode}", "reference: ${input.promoCode}", "${input.promoCode}".
- NEVER write the word "code" before or after it.
${input.bonusDescription ? `- If a value is mentioned, encode it as a neutral reference like "tier ${input.bonusDescription} credit" or "level ${input.bonusDescription} allocation". NEVER use "%", "$", "bonus", "free", "freeplay".` : "- Do NOT mention any bonus, percentage, dollar amount, or freeplay value."}`;
      break;

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
- Use everyday spoken phrases drawn from a wide pool: "hey", "btw", "fyi", "heads up", "quick one", "sooo", "k so", "real quick", "just dropped", "saw this and thought of you", "thought you'd want to know", "okay this is actually pretty cool", "wait —", "psst", "hold up", "passing this along", "worth a peek".
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
- NEVER use the literal English word "code" (or "promo code", "coupon code", "use code", "with code", "enter code"). It is a US carrier spam trigger. Refer to any code value DIRECTLY by name only — e.g. "use WELCOME50", "with WELCOME50", "try WELCOME50", or just "WELCOME50".
${userCodes.length > 0 ? `- The user-provided value(s) ${userCodes.map((c) => `"${c}"`).join(", ")} MUST appear verbatim. They are ALWAYS allowed even if they resemble forbidden words. Mention them naturally, e.g. "use ${userCodes[0]}" or "with ${userCodes[0]}" — never preceded or followed by the word "code".` : ""}

DIVERSITY RULES (critical — applies across the six variants):
- No two variants may start with the same first word. Six variants → six different opening words.
- Do NOT overuse "ngl". At most ONE variant across all six may use "ngl", and only if it genuinely fits — preferably none use it.
- Vary sentence shape across casual variants: don't make all three lowercase-only, don't make all three start with an interjection, don't reuse the same opener pattern twice.

VARIANTS — return SIX messages, all conveying the same offer and code/value.

The first three are STANDARD style — clean, professional, brand-safe SMS copy. Polished but still natural. Proper sentence case. No slang, no abbreviations like "ngl"/"btw", no lowercase-only sentences. Think how a well-run marketing team would write it.
- "message" (primary standard): the cleanest, most balanced version. Clear value, friendly, professional.
- "standardA": informative angle. Lead with what they get. Direct and clear.
- "standardB": benefit-led angle. Lead with the outcome or feeling. Still polished.

The last three are CASUAL style — daily US text-message tone using the VOICE rules above (lowercase ok, slang ok, sentence fragments ok, curiosity hooks). Each casual variant has its OWN opener pool — pick from its pool, do not borrow from another variant's pool:
- "casualA": curiosity hook. Opener pool: "okay so...", "wait —", "you're gonna want to see this", "this is kinda wild", "hold up", "saw this and thought of you", "this looks legit". Make them wonder what's behind the offer without giving everything away.
- "casualB": friend-recommendation style. Opener pool: "heads up —", "thought you'd want this", "passing this along", "worth a peek", "this one's for you", "buddy this just dropped". Reads like a friend forwarding something.
- "casualC": casual heads-up / FYI style. Opener pool: "fyi", "quick one", "real quick", "psst", "just dropped", "live now", "k so this just popped up". Short, low-key, like a quick text from a friend.

Rules for ALL six variants:
- Same offer. Same code/value if applicable.
- Noticeably different wording, sentence shape, and opener so carriers don't dedupe on bulk send.
- Every variant must follow ALL rules above${input.ctaLink && input.ctaLink.trim() ? " and end with the link" : ""}.

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

          // Length caps to prevent oversized prompt abuse
          const tooLong = (s: string | undefined, max: number) =>
            typeof s === "string" && s.length > max;
          if (tooLong(body.offerDetails, 2000)) {
            return Response.json({ error: "Offer details must be 2000 chars or less." }, { status: 400 });
          }
          if (
            tooLong(body.brandName, 200) ||
            tooLong(body.couponCode, 100) ||
            tooLong(body.promoCode, 100) ||
            tooLong(body.bonusAmount, 100) ||
            tooLong(body.bonusDescription, 500) ||
            tooLong(body.freePlayReward, 200) ||
            tooLong(body.extraForbidden, 1000) ||
            tooLong(body.ctaLink, 500)
          ) {
            return Response.json({ error: "One or more fields exceed the allowed length." }, { status: 400 });
          }
          if (Array.isArray(body.activeCategories) && body.activeCategories.length > 50) {
            return Response.json({ error: "Too many categories." }, { status: 400 });
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

          const prompt = buildPrompt(body);

          const SMS_TOOL = {
            type: "function" as const,
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
                      "Casual variant A — daily US text style, curiosity hook. Pick opener from: 'okay so', 'wait —', 'you're gonna want to see this', 'this is kinda wild', 'hold up', 'saw this and thought of you'. Must NOT share a first word with any other variant. Avoid 'ngl'. Never use the word 'code'.",
                  },
                  casualB: {
                    type: "string",
                    description:
                      "Casual variant B — daily US text style, friend-recommendation tone. Pick opener from: 'heads up —', 'thought you'd want this', 'passing this along', 'worth a peek', 'this one's for you'. Must NOT share a first word with any other variant. Avoid 'ngl'. Never use the word 'code'.",
                  },
                  casualC: {
                    type: "string",
                    description:
                      "Casual variant C — daily US text style, low-key FYI tone. Pick opener from: 'fyi', 'quick one', 'real quick', 'psst', 'just dropped', 'live now', 'k so this just popped up'. Must NOT share a first word with any other variant. Avoid 'ngl'. Never use the word 'code'.",
                  },
                },
                required: ["message", "standardA", "standardB", "casualA", "casualB", "casualC"],
                additionalProperties: false,
              },
            },
          };

          const result = await callClaudeWithTool(prompt, SMS_TOOL);
          if (!result.ok) {
            return Response.json(
              { error: result.error, ...(result.details ? { details: result.details } : {}) },
              { status: result.status },
            );
          }

          return Response.json(result.args);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
