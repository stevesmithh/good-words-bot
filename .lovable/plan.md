## Add "Friendly" inbox type (3rd selector)

Add a third inbox option called **Friendly** alongside Promotional and Primary. It uses the exact prompt you sent, stored verbatim and kept fully separate from the other two prompts.

### 1. Backend — `src/routes/api/generate-email.ts`

- Extend `InboxType` to `"promotional" | "primary" | "friendly"`.
- Add a new constant `FRIENDLY_INBOX_PROMPT_TEMPLATE` containing your prompt **exactly as you wrote it**, ending with the placeholder `[USER'S OFFER DETAILS GO HERE]` where the offer gets injected.

The exact text that will be stored (verbatim, untouched):

```
You are an elite Email Strategist & Deliverability Expert with 10+ years of experience crafting emails that land in the Primary inbox while maintaining high engagement.

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

[USER'S OFFER DETAILS GO HERE]
```

- Add `buildFriendlyPrompt({ offerDetails, audience, brandName })`:
  - Replaces only `[USER'S OFFER DETAILS GO HERE]` with the user's offer text.
  - Appends the same minimal structured-output footer used for Primary mode (audience tone hint, optional brand sign-off override that swaps "BitPlay" → user's brand, and a tool-calling instruction). The original prompt body above is **never modified**.
- Add `FRIENDLY_TOOL` (function name `return_friendly_email`) with 4 required fields matching the Friendly output format: `subject`, `preheader`, `body`, `cta`.
- Update the handler branching:
  ```ts
  const prompt =
    inboxType === "primary"  ? buildPrimaryPrompt(...)  :
    inboxType === "friendly" ? buildFriendlyPrompt(...) :
    buildPromotionalPrompt(...);

  const tool =
    inboxType === "primary"  ? PRIMARY_TOOL  :
    inboxType === "friendly" ? FRIENDLY_TOOL :
    PROMOTIONAL_TOOL;
  ```
- Friendly response shape: `{ inboxType: "friendly", subject, preheader, body, cta }`.

### 2. Frontend — `src/components/EmailGenerator.tsx`

- Extend `InboxType` to include `"friendly"` and add `FriendlyResult` (same shape as `PrimaryResult`).
- Inbox-type selector: switch grid to `sm:grid-cols-3`, add a third button **Friendly** with a `Smile` icon. Subtitle stays neutral and does NOT hint at the underlying prompt — e.g. *"Simple, easy-to-read tone."*
- Replace `isPrimary` checks with `isStrict = inboxType !== "promotional"` so Friendly also:
  - Hides "Extra forbidden words" and "Spam categories" filters.
  - Keeps Audience + Brand selectors.
  - Shows a generic info note (no internal-prompt hints).
- Output rendering: reuse the existing Primary output layout for Friendly results (Subject / Preheader / Email body with markdown bold / CTA). Extend `fullEmail` to handle the friendly branch identically to primary.
- v2.0 badge stays as is.

### Notes

- Friendly prompt is its own constant — fully isolated from Primary and Promotional builders.
- Only the `[USER'S OFFER DETAILS GO HERE]` placeholder is touched; everything above it is sent to the model byte-for-byte as you wrote it.
- UI copy never reveals the prompt mechanics to end users.
