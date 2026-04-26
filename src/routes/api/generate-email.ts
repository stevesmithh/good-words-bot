import { createFileRoute } from "@tanstack/react-router";
import { SPAM_CATEGORIES, SAFE_REPLACEMENTS, type SpamCategoryId } from "@/lib/spam-words";

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
// PRIMARY INBOX PROMPT — used VERBATIM, every single time.
// Do NOT edit, shorten, or paraphrase this prompt. Only the user's offer
// details are appended at the bottom where the placeholder lives.
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

3. **Email Body Structure**

   - Personal greeting: "Hi {{ insert first_name 'default=default' }}," or "Hi [First Name],"

   - Warm but calm opening line (1 sentence)

   - Clear explanation of what happened or what needs to be done

   - Bullet points for details when useful

   - One clear CTA with strong button text

   - Soft helpful closing

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

- Keep total email readable in under 15 seconds on mobile

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

IMPORTANT: Return your answer by calling the provided tool "return_primary_email" with these fields:
- subject: the Subject Line text only (no "**Subject Line:**" prefix, no emoji, 6–8 words).
- preheader: the Preheader text only (one short neutral sentence).
- body: the full Email Body starting from the greeting through the sign-off. Preserve markdown bold (**like this**) and use blank lines (\\n\\n) between paragraphs. Do NOT include the subject line or preheader inside the body. Do NOT include the CTA button text on its own line — the button label itself goes in the cta field.
- cta: the CTA button label only, 2–4 words, strong and clear (e.g. "View Your Account", "Complete Registration", "Open Quests"). No emojis.`;
}

// =====================================================================
// FRIENDLY INBOX PROMPT — used VERBATIM, every single time.
// Do NOT edit, shorten, or paraphrase this prompt. Only the user's offer
// details are appended at the bottom where the placeholder lives.
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

### NEW IMPORTANT RULE - EXTREME SIMPLICITY

- Use very simple, everyday words.

- Write like you are explaining to a 15-year-old student.

- Use short sentences (maximum 15-20 words per sentence).

- Use short paragraphs (2-3 lines max).

- Make the email extremely easy to read and understand in under 10 seconds.

- Avoid complex words. Use simple alternatives.

- Make the message crystal clear so anyone can understand it immediately.

### ALWAYS FOLLOW THIS EXACT STRUCTURE

1. **Subject Line**

   - Maximum 6-8 words

   - Clear and action-oriented

   - Sounds like an account update

2. **Preheader** (1 short helpful sentence)

3. **Email Body Structure**

   - Personal greeting: "Hi {{ insert first_name 'default=default' }},"

   - One short, warm opening line

   - Clear explanation

   - Bullet points for details (keep them very simple)

   - One clear CTA button

   - Helpful closing

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

- Keep total email short and scannable

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
- Body: structured as 2–3 short paragraphs separated by a blank line (\\n\\n). Sentences inside a paragraph flow naturally on the same line — do NOT put every sentence on its own line. Structure:
  1. Opening paragraph (1–3 sentences): warm opener tailored to the audience, leading into why you are writing. Sentences flow together in the same paragraph.
  2. Rewards block: one short intro line, then each reward on its own line as a compact list (this is the ONLY place line breaks per item are allowed). Format each reward line as "Label: value" (e.g. "Goldmine Rewards: up to $300 weekly").
  3. Closing paragraph (1–2 sentences): a soft, low-pressure nudge about where to find it or how to use it. No "click here", no "buy now". Sentences flow on the same line.
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
        body: { type: "string", description: "Email body as 2-3 short paragraphs separated by a blank line (\\n\\n)." },
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
        body: { type: "string", description: "Full email body from greeting through sign-off 'Best regards, The BitPlay Team'. Preserve markdown bold (**like this**). Paragraphs separated by \\n\\n." },
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
        body: { type: "string", description: "Full email body from greeting through sign-off 'Best regards, The BitPlay Team'. Very simple language, short sentences (max 15-20 words), short paragraphs (2-3 lines). Preserve markdown bold (**like this**). Paragraphs separated by \\n\\n." },
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

          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) {
            return Response.json(
              { error: "AI is not configured. LOVABLE_API_KEY missing." },
              { status: 500 },
            );
          }

          const inboxType: InboxType = body.inboxType === "primary" ? "primary" : "promotional";

          const prompt =
            inboxType === "primary"
              ? buildPrimaryPrompt({
                  offerDetails: body.offerDetails,
                  audience: body.audience,
                  brandName: body.brandName,
                })
              : buildPromotionalPrompt(body);

          const tool = inboxType === "primary" ? PRIMARY_TOOL : PROMOTIONAL_TOOL;
          const toolName = tool.function.name;

          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [{ role: "user", content: prompt }],
              tools: [tool],
              tool_choice: { type: "function", function: { name: toolName } },
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

          let parsed: Record<string, string>;
          try {
            parsed = JSON.parse(argsStr);
          } catch {
            return Response.json(
              { error: "Could not parse response", raw: argsStr },
              { status: 502 },
            );
          }

          const normalizeNewlines = (s: string) =>
            s
              .replace(/\\r\\n/g, "\n")
              .replace(/\\n/g, "\n")
              .replace(/\\t/g, "\t");

          if (inboxType === "primary") {
            return Response.json({
              inboxType: "primary",
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
