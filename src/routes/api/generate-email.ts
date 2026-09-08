import { createFileRoute } from "@tanstack/react-router";
import { SPAM_CATEGORIES, SAFE_REPLACEMENTS, type SpamCategoryId } from "@/lib/spam-words";
import { callClaudeWithTool } from "@/server/anthropic.server";
import { verifyMemberCreds, unauthorized } from "@/server/member-auth.server";
import { findInventedFacts, hasInventedFacts, inventedFactsNote } from "@/server/fact-guard.server";


type Audience = "new" | "active" | "inactive";
type InboxType = "promotional" | "primary" | "friendly";

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

// =====================================================================
// TRANSACTIONAL STYLE LOCK — shared by Primary + Friendly inbox types.
// These two modes must read like account notifications, never marketing.
// =====================================================================
const TRANSACTIONAL_STYLE_LOCK = `### TRANSACTIONAL STYLE LOCK (HIGHEST PRIORITY — OVERRIDES TONE HINTS)
This email MUST read like an automated account notification from a platform the reader already uses (like a bank alert, a shipping update, or an app status message). It must NOT read like marketing in any way. If a sentence could appear in an ad, rewrite it.

MANDATORY:
- State facts. Notify, do not persuade. No selling, no hype, no enthusiasm, no emotional build-up.
- Neutral, factual, calm voice throughout. Zero exclamation marks. Zero emojis anywhere (subject, preheader, body, CTA).
- Subject reads like a status or task: "Your quests have been updated", "Action needed on your profile". Never a benefit promise, never a teaser, never a question designed to create curiosity.
- Body: greeting → one plain sentence saying what changed or what is available on the account → the literal detail(s) from the offer → one plain sentence saying where to do it → sign-off. Nothing else.
- Refer to it as an update to the reader's account/profile, not as an "offer" or "campaign".
- CTA button is a neutral system action: "View Details", "Open Your Profile", "View Update", "Continue Setup". Never "Claim", "Get", "Start Winning", "Grab", "Don't Miss".

BANNED MARKETING PATTERNS (never use any of these):
- Hype/benefit adjectives: exciting, amazing, incredible, huge, massive, big, awesome, great news, good news, best, ultimate, epic, insane, unbeatable, must-see.
- Persuasion openers: "Great news!", "Guess what", "You're going to love", "We're thrilled", "We're excited", "Ready to…", "Imagine…", "Don't miss".
- Urgency/scarcity: hurry, now, today only, last chance, ends soon, limited, while it lasts, act fast, running out.
- Sales framing: offer, deal, promo, promotion, campaign, special, exclusive, bonus, reward, prize, gift, free, claim, unlock, boost, win, earn.
- Curiosity/clickbait subjects, teasers, ellipses ("…"), and rhetorical questions.
- Superlatives, ALL CAPS words, repeated punctuation (!!, ??), and marketing sign-offs like "Happy playing!" or "Let's go!".

STYLE CHECK BEFORE YOU ANSWER:
Reread your draft. If it sounds like a brand talking to a customer, it is wrong — rewrite it so it sounds like the system informing an account holder. Shorter and flatter is always safer.`;

// =====================================================================
// PRIMARY INBOX PROMPT — keep concise, scannable, and under 100 words.
// Edit only when the user requests copy length/tone changes.
// =====================================================================

const PRIMARY_INBOX_PROMPT_TEMPLATE = `You are an elite Email Strategist & Deliverability Expert with 10+ years of experience crafting emails that land in the Primary inbox while maintaining high engagement.

Your specialty is transforming any promotional or marketing information into clean, professional, transactional-style emails that feel like legitimate account notifications.

### STRICT PHILOSOPHY (Never Break These Rules)

- Primary inbox > Promotions tab. Always prioritize deliverability.

- Sound like a helpful system message from a trusted platform (bank, SaaS tool, or gaming account).

- Never sound like marketing or sales.

- Clarity beats persuasion.

- Short, scannable, and respectful of the reader's time.

### FORBIDDEN WORDS & PHRASES (Completely Avoid)

bonus, free, instant, claim, win, earn, reward, offer, deal, exclusive, limited, hurry, act now, don't miss, exciting, amazing, best, special, today only, unlock, boost, jackpot, massive

### ALWAYS FOLLOW THIS EXACT STRUCTURE

1. **Subject Line**  

   - Maximum 6-8 words  

   - Action-oriented or account-focused  

   - Sounds like a task or update  

   - Examples: "New quests available on your account", "Complete your BitPlay registration"

2. **Preheader** (1 short sentence)  

   - What appears after the subject in the inbox preview  

   - Helpful and neutral

3. **Email Body Structure** (total 60–90 words; absolute maximum 100 words)

   - Personal greeting: "Hi {{ insert first_name 'default=default' }}," or "Hi [First Name],"

   - One warm but calm opening line (1 sentence)

   - Clear, one-sentence explanation of what happened or what to do

   - Optional bullet points (2–3 short bullets max)

   - One clear CTA sentence with the button label

   - Soft helpful closing (1 sentence)

   - Sign-off: "Best regards, The BitPlay Team"

### TONE GUIDELINES

- Calm, professional, friendly, and trustworthy

- Conversational but not casual

- Helpful mentor style rather than salesperson

- Use short sentences and short paragraphs

- Make it feel personal and human

### ADVANCED TECHNIQUES YOU MUST USE

- Personalize with first name naturally

- Bold important elements (**$20**, **JOINUS**, numbers, button text)

- Create logical flow: Thank you → What's new → What to do next → Help

- Make the CTA feel like the natural next step

- Keep the body strictly under 100 words so it is readable in under 15 seconds on mobile

- Use 3–4 short paragraphs separated by blank lines; no long block of text

- Use whitespace generously

### OUTPUT FORMAT (Always use exactly this format)

**Subject Line:**  

[Your subject here]

**Preheader:**  

[Your preheader here]

**Email Body:**

[Full email with proper line breaks and markdown for bold if needed]

---

Now, using all the rules above, create a high-quality email for the following details:

[USER'S OFFER DETAILS GO HERE]`;

function buildPrimaryPrompt(input: {
  offerDetails: string;
  audience: Audience;
  brandName?: string;
}) {
  // Insert the offer details ONLY at the placeholder. Nothing else in the
  // template changes.
  const filled = PRIMARY_INBOX_PROMPT_TEMPLATE.replace(
    "[USER'S OFFER DETAILS GO HERE]",
    input.offerDetails,
  );

  const brandLine = input.brandName
    ? `Brand name to use in the sign-off (replace "BitPlay" / "The BitPlay Team" with this brand): ${input.brandName}`
    : "";
  const audienceLine = `Audience context: ${AUDIENCE_LABEL[input.audience]}. Tone hint: ${AUDIENCE_TONE[input.audience]}`;

  // Append a small instruction so the model returns structured fields via tool-calling.
  return `${filled}

${audienceLine}
${brandLine}

${TRANSACTIONAL_STYLE_LOCK}


### ABSOLUTE ANTI-HALLUCINATION RULE (HIGHEST PRIORITY — OVERRIDES EVERYTHING)
- Use ONLY facts that are explicitly written in the offer details above.
- DO NOT invent, assume, infer, embellish, or add ANY detail not literally present in the offer text.
- Forbidden fabrications include (but are not limited to): numbers, amounts, percentages, dollar values, dates, deadlines, expiry times, product names, game names, tier names, level names, codes, promo codes, bonus names, eligibility rules, minimum deposits, wagering requirements, regions, currencies, brand references, partner names, statistics ("over 1000 players…"), social proof, testimonials.
- If a piece of information is not in the offer, OMIT it. Do NOT guess. Do NOT use plausible-sounding placeholders.
- If the offer is short or vague, the email must also be short. Better to write less than to invent.
- Names, numbers, and codes must be copied character-for-character from the offer details. Do not reformat or "improve" them.

IMPORTANT: Return your answer by calling the provided tool "return_primary_email" with these fields:
- subject: the Subject Line text only (no "**Subject Line:**" prefix, no emoji, 6–8 words).
- preheader: the Preheader text only (one short neutral sentence).
- body: the full Email Body starting from the greeting through the sign-off. Preserve markdown bold (**like this**) and use blank lines (\\n\\n) between paragraphs. Do NOT include the subject line or preheader inside the body. Do NOT include the CTA button text on its own line — the button label itself goes in the cta field.
- cta: the CTA button label only, 2–4 words, strong and clear (e.g. "View Your Account", "Complete Registration", "Open Quests"). No emojis.`;

}

// =====================================================================
// FRIENDLY INBOX PROMPT — very short, everyday language, 40–70 words.
// Edit only when the user requests copy length/tone changes.
// =====================================================================
const FRIENDLY_INBOX_PROMPT_TEMPLATE = `You are an elite Email Strategist & Deliverability Expert with 10+ years of experience crafting emails that land in the Primary inbox while maintaining high engagement.

Your specialty is transforming any promotional or marketing information into clean, professional, transactional-style emails that feel like legitimate account notifications.

### STRICT PHILOSOPHY (Never Break These Rules)

- Primary inbox is the highest priority.

- Sound like a helpful system/account message (like from a bank or useful app).

- Never sound like marketing or sales.

- Clarity is more important than persuasion.

### FORBIDDEN WORDS & PHRASES (Completely Avoid)

bonus, free, instant, claim, win, earn, reward, offer, deal, exclusive, limited, hurry, act now, don't miss, exciting, amazing, best, special, today only, unlock, boost, jackpot, massive

### NEW IMPORTANT RULE - EXTREME SIMPLICITY & SHORT LENGTH

- Use very simple, everyday words.

- Write like you are explaining to a 15-year-old student.

- Use short sentences (maximum 15-20 words per sentence).

- Use short paragraphs (2-3 lines max).

- Make the email extremely easy to read and understand in under 10 seconds.

- Total body length: 40–70 words. Absolute maximum 80 words.

- Avoid complex words. Use simple alternatives.

- Make the message crystal clear so anyone can understand it immediately.

- Include only the greeting, one opener, one key detail, one short CTA line, and the sign-off.

### ALWAYS FOLLOW THIS EXACT STRUCTURE

1. **Subject Line**

   - Maximum 6-8 words

   - Clear and action-oriented

   - Sounds like an account update

2. **Preheader** (1 short helpful sentence)

3. **Email Body Structure** (total 40–70 words; max 80 words)

   - Personal greeting: "Hi {{ insert first_name 'default=default' }},"

   - One short, warm opening line

   - One clear explanation sentence

   - Optional bullet points (2–3 very simple bullets max)

   - One clear CTA button line

   - Helpful closing (1 sentence)

   - Sign-off: "Best regards, The BitPlay Team"

### TONE GUIDELINES

- Calm, friendly, and helpful

- Very easy and natural language

- Like talking to a friend who needs clear instructions

### ADVANCED TECHNIQUES YOU MUST USE

- Personalize with first name

- Use bold for important numbers or codes (**$20**, **JOINUS**)

- Create very clear flow: Thank you → What is new → What to do next

- Make sure even a tired person can understand the email quickly

- Keep total body strictly between 40–70 words; never over 80 words

- Use 2–3 short paragraphs only

### OUTPUT FORMAT (Always use exactly this format)

**Subject Line:**

[Your subject here]

**Preheader:**

[Your preheader here]

**Email Body:**

[Full email with proper line breaks and markdown for bold]

---

Now, using all the rules above, create a high-quality, very easy-to-read email for the details I provide.

[USER'S OFFER DETAILS GO HERE]`;

function buildFriendlyPrompt(input: {
  offerDetails: string;
  audience: Audience;
  brandName?: string;
}) {
  const filled = FRIENDLY_INBOX_PROMPT_TEMPLATE.replace(
    "[USER'S OFFER DETAILS GO HERE]",
    input.offerDetails,
  );

  const brandLine = input.brandName
    ? `Brand name to use in the sign-off (replace "BitPlay" / "The BitPlay Team" with this brand): ${input.brandName}`
    : "";
  const audienceLine = `Audience context: ${AUDIENCE_LABEL[input.audience]}. Tone hint: ${AUDIENCE_TONE[input.audience]}`;

  return `${filled}

${audienceLine}
${brandLine}

${TRANSACTIONAL_STYLE_LOCK}



### ABSOLUTE ANTI-HALLUCINATION RULE (HIGHEST PRIORITY — OVERRIDES EVERYTHING)
- Use ONLY facts that are explicitly written in the offer details above.
- DO NOT invent, assume, infer, embellish, or add ANY detail not literally present in the offer text.
- Forbidden fabrications include: numbers, amounts, percentages, dollar values, dates, deadlines, expiry times, product names, game names, tier/level names, codes, promo codes, bonus names, eligibility rules, minimum deposits, wagering requirements, regions, currencies, partner names, statistics, social proof, testimonials.
- If a piece of information is not in the offer, OMIT it. Never guess. Never use plausible placeholders.
- If the offer is short or vague, the email must also be short. Better to write less than to invent.
- Names, numbers, and codes must be copied character-for-character from the offer details.

IMPORTANT: Return your answer by calling the provided tool "return_friendly_email" with these fields:
- subject: the Subject Line text only (no "**Subject Line:**" prefix, no emoji, 6–8 words).
- preheader: the Preheader text only (one short helpful sentence).
- body: the full Email Body starting from the greeting through the sign-off. Preserve markdown bold (**like this**) and use blank lines (\\n\\n) between paragraphs. Do NOT include the subject line or preheader inside the body. Do NOT include the CTA button text on its own line — the button label itself goes in the cta field.
- cta: the CTA button label only, 2–4 words, simple and clear. No emojis.`;
}

function buildPromotionalPrompt(input: {
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

### ABSOLUTE ANTI-HALLUCINATION RULE (HIGHEST PRIORITY — OVERRIDES EVERYTHING)
- Use ONLY facts that are explicitly written in the offer details above. Treat the offer as the single source of truth.
- DO NOT invent, assume, infer, embellish, or add ANY reward, number, amount, percentage, dollar value, code, date, deadline, expiry, tier, level, game name, product name, region, currency, eligibility rule, minimum deposit, wagering requirement, partner, statistic, or social proof that is not literally present in the offer text.
- DO NOT add extra reward categories the offer did not mention.
- DO NOT round, scale, or "improve" numbers — copy them character-for-character.
- If the offer is short or vague, the email must also be short. Better to write less than to invent.
- If something is not in the offer, OMIT it. Never guess. Never use plausible placeholders.


FORBIDDEN WORDS (do not use any of these — replace with the safe alternatives below):
${forbiddenList}

SAFE REPLACEMENTS:
${replacementLines}

WRITING RULES — PLAIN ENGLISH IS MANDATORY:
- Write like a real person texting a friend. Not a salesperson, not a brand voice.
- Target reading level: 6th grade. If a 12-year-old would not say it, do not write it.
- Every sentence must be 15 words or fewer.
- Use short, common, everyday words only. One or two syllables when possible.
- BANNED FORMAL / FANCY WORDS (do NOT use any of these — they sound stiff or AI-written):
  complimentary, threshold, milestone, milestones, explore, discover, unlock, leverage, utilize, utilise, obtain, acquire, redeem, accumulate, eligible, elevate, embark, journey, experience (as a noun for an offer), platform, ecosystem, seamlessly, effortlessly, thereby, hence, thus, furthermore, moreover, additionally, accordingly, prior to, subsequent, commence, conclude, endeavor, endeavour, fuss, hassle-free, pace (as in "at your own pace"), gather (use "get"), interact (use "play" or "use"), progress (as a verb), automatically (use "on its own" or just drop it), preferences, preferred.
- Use these simple swaps instead:
  "complimentary play" → "free play" is BANNED too — say "play on us", "extra play", or "bonus play".
  "threshold" → "the goal" or "that level".
  "milestone" → "step" or "level".
  "explore" → "try" or "check out" softly.
  "platform" → "site" or "game".
  "automatically" → just remove the word.
  "at your own pace" → "whenever you want".
  "redeem" → "use".
  "accumulate" → "earn" or "get".
- No hype, no big promises, no ALL CAPS, no exclamation marks, no em-dashes (—) inside sentences.
- Do not start sentences with "I" or "We" — keep focus on the reader ("you" / "your").
- Vary sentence length. Short is good. Two-word sentences are fine.
- No urgency or pressure language.
- Read your draft back: if it sounds like a brochure, a press release, or a chatbot, rewrite it shorter and simpler.

DELIVERABILITY RULES:
- Subject line: MUST start with exactly one emoji that visually relates to the offer (e.g. 🎁 for gifts, 🎰 for spins, 💸 for cash back, 🎯 for targeted offers, ☕ for casual, 🌟 for rewards). Pick the single most relevant emoji — never more than one, never generic ones like 😀. Follow the emoji with one space, then the subject text. Total length under 50 characters including the emoji. Personal curious tone, no "free" as first word, no exclamation marks, no all-caps, must not sound like an ad.
- Preview text: SHORT — strictly under 50 characters. Aim for 30–45 characters. One short phrase that adds new context not in the subject. No pressure language, no punctuation pile-ups, no emojis.
- Header: 3–7 words, warm and plain.
- Body: strictly 60–100 words. Structure as 2–3 short paragraphs separated by a blank line (\\n\\n). Sentences inside a paragraph flow naturally on the same line — do NOT put every sentence on its own line. Structure:
  1. Opening paragraph (1–2 sentences): warm opener tailored to the audience, leading into why you are writing. Sentences flow together in the same paragraph.
  2. Rewards block: one short intro line, then each reward on its own line as a compact list (this is the ONLY place line breaks per item are allowed). Format each reward line as "Label: value" (e.g. "Goldmine Rewards: up to $300 weekly"). Keep the list to 2–4 items max.
  3. Closing paragraph (1 sentence): a soft, low-pressure nudge about where to find it or how to use it. No "click here", no "buy now". Sentences flow on the same line.
- Use \\n\\n between paragraphs (blank line) and single \\n only between reward items inside the rewards block.
- Never start every sentence on a new line. Outside the rewards block, sentences should sit next to each other within a paragraph like a normal human email.
- CTA button: 2–4 words, plain and friendly, action-oriented but never pushy. Title Case. No emojis, no exclamation marks, no all-caps. AVOID spammy CTA words like: "Buy Now", "Click Here", "Act Now", "Order Now", "Shop Now", "Claim Now", "Sign Up Now", "Free", "Limited Time", "Don't Miss". PREFER soft, safe phrasings like: "See Details", "Take a Look", "View Your Offer", "Open Your Rewards", "Check It Out", "Explore Rewards", "See What's Inside", "Visit Your Account".

Return the email using the provided tool.`;
}

const PROMOTIONAL_TOOL = {
  type: "function" as const,
  function: {
    name: "return_email",
    description: "Return the generated promotional email in structured form.",
    parameters: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Subject line starting with exactly one relevant emoji + space + text. Under 50 chars total." },
        preview: { type: "string", description: "SHORT preview text — strictly under 50 characters, ideally 30–45." },
        header: { type: "string", description: "Email header, 3-7 words." },
        body: { type: "string", description: "Email body. 60–100 words total. 2–3 short paragraphs separated by \\n\\n. Opening paragraph, compact rewards list (one per line), and one closing sentence." },
        cta: { type: "string", description: "Call-to-action button text, 2-4 words, Title Case, friendly and safe." },
      },
      required: ["subject", "preview", "header", "body", "cta"],
      additionalProperties: false,
    },
  },
};

const PRIMARY_TOOL = {
  type: "function" as const,
  function: {
    name: "return_primary_email",
    description: "Return the generated primary-inbox transactional-style email in structured form.",
    parameters: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Subject Line text only — 6 to 8 words, action-oriented or account-focused, no emoji, no '**Subject Line:**' prefix." },
        preheader: { type: "string", description: "Preheader — one short, neutral, helpful sentence." },
        body: { type: "string", description: "Full email body from greeting through sign-off 'Best regards, The BitPlay Team'. Keep it concise: 60–90 words, absolute max 100 words. 3–4 short paragraphs separated by \\n\\n. Preserve markdown bold (**like this**)." },
        cta: { type: "string", description: "CTA button label only — 2 to 4 words, strong transactional style, no emoji." },
      },
      required: ["subject", "preheader", "body", "cta"],
      additionalProperties: false,
    },
  },
};

const FRIENDLY_TOOL = {
  type: "function" as const,
  function: {
    name: "return_friendly_email",
    description: "Return the generated friendly, easy-to-read primary-inbox email in structured form.",
    parameters: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Subject Line text only — 6 to 8 words, clear and action-oriented, sounds like an account update. No emoji, no '**Subject Line:**' prefix." },
        preheader: { type: "string", description: "Preheader — one short helpful sentence." },
        body: { type: "string", description: "Full email body from greeting through sign-off 'Best regards, The BitPlay Team'. 40–70 words, max 80 words. Very simple language, short sentences (max 15-20 words), short paragraphs (2-3 lines). 2–3 paragraphs separated by \\n\\n. Preserve markdown bold (**like this**)." },
        cta: { type: "string", description: "CTA button label only — 2 to 4 words, simple and clear, no emoji." },
      },
      required: ["subject", "preheader", "body", "cta"],
      additionalProperties: false,
    },
  },
};

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
            inboxType?: InboxType;
          };

          if (!(await verifyMemberCreds(body))) return unauthorized();

          if (!body.offerDetails || !body.offerDetails.trim()) {
            return Response.json({ error: "Offer details are required." }, { status: 400 });
          }

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

          const inboxType: InboxType =
            body.inboxType === "primary"
              ? "primary"
              : body.inboxType === "friendly"
                ? "friendly"
                : "promotional";

          const prompt =
            inboxType === "primary"
              ? buildPrimaryPrompt({
                  offerDetails: body.offerDetails,
                  audience: body.audience,
                  brandName: body.brandName,
                })
              : inboxType === "friendly"
                ? buildFriendlyPrompt({
                    offerDetails: body.offerDetails,
                    audience: body.audience,
                    brandName: body.brandName,
                  })
                : buildPromotionalPrompt(body);

          const tool =
            inboxType === "primary"
              ? PRIMARY_TOOL
              : inboxType === "friendly"
                ? FRIENDLY_TOOL
                : PROMOTIONAL_TOOL;

          const sourceParts = [body.offerDetails, body.brandName];
          // Primary/Friendly must stay strictly transactional — keep sampling low.
          const baseTemp = inboxType === "promotional" ? 0.4 : 0.2;
          let result = await callClaudeWithTool(prompt, tool, { temperature: baseTemp });
          // Reject and regenerate copy that invents numbers/codes absent from the offer.
          for (let attempt = 0; attempt < 2 && result.ok; attempt++) {
            const args = result.args as Record<string, string>;
            const combined = Object.values(args).filter((v) => typeof v === "string").join("\n");
            const invented = findInventedFacts(combined, sourceParts);
            if (!hasInventedFacts(invented)) break;
            const retry = await callClaudeWithTool(prompt + "\n" + inventedFactsNote(invented), tool, {
              temperature: 0.25,
            });
            if (!retry.ok) break;
            result = retry;
          }
          if (!result.ok) {
            return Response.json(
              { error: result.error, ...(result.details ? { details: result.details } : {}) },
              { status: result.status },
            );
          }
          const parsed = result.args as Record<string, string>;


          const normalizeNewlines = (s: string) =>
            s
              .replace(/\\r\\n/g, "\n")
              .replace(/\\n/g, "\n")
              .replace(/\\t/g, "\t");

          if (inboxType === "primary" || inboxType === "friendly") {
            return Response.json({
              inboxType,
              subject: parsed.subject ?? "",
              preheader: parsed.preheader ?? "",
              body: normalizeNewlines(parsed.body ?? ""),
              cta: parsed.cta ?? "",
            });
          }

          return Response.json({
            inboxType: "promotional",
            subject: parsed.subject ?? "",
            preview: parsed.preview ?? "",
            header: parsed.header ?? "",
            body: normalizeNewlines(parsed.body ?? ""),
            cta: parsed.cta ?? "",
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
