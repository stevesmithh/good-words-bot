# Email Generator v2.0 — Inbox Type Selection

Add an **Inbox Type** selector to the email generator with two modes that completely change how the email is produced.

## What the user gets

A new selector at the top of the form:
- **Promotional inbox** — current behavior (normal promotional email, still avoids spam triggers and banned words)
- **Primary inbox** — new behavior, uses your exact "Elite Email Strategist & Deliverability Expert" prompt **verbatim, every single time**, producing transactional-style account-notification emails

## The exact Primary-inbox prompt (used verbatim, every time)

When the user picks **Primary**, the backend will send this prompt to the AI **with no edits, no shortening, no paraphrasing** — only the user's offer details get appended at the end where you marked the placeholder:

```
You are an elite Email Strategist & Deliverability Expert with 10+ years of experience crafting emails that land in the Primary inbox while maintaining high engagement.

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

[USER'S OFFER DETAILS GO HERE]
```

This whole block is stored as a single constant in the backend route file. The only dynamic part is replacing `[USER'S OFFER DETAILS GO HERE]` with whatever the user typed in the offer textarea. Everything else — including the BitPlay sign-off, the forbidden words list, the structure rules — stays exactly as you wrote it.

## Output structure per mode

**Promotional mode** (unchanged from today):
- Subject (with emoji prefix), Preview, Header, Body, CTA

**Primary mode** (matches your prompt's output format):
- Subject Line (6–8 words, no emoji, account/task focused)
- Preheader (1 short neutral sentence)
- Email Body (greeting → opener → explanation → bullets if useful → CTA → soft close → "Best regards, The BitPlay Team")
- CTA button text (extracted separately so the button can be styled in the UI)

## Plan

### 1. Backend — `src/routes/api/generate-email.ts`
- Accept new field `inboxType: "promotional" | "primary"` (default `"promotional"` for backward compatibility).
- Store the exact prompt above as a `const PRIMARY_INBOX_PROMPT` string — verbatim, no edits.
- Branch:
  - **Promotional**: keep existing `buildPrompt` exactly as it is today.
  - **Primary**: take `PRIMARY_INBOX_PROMPT` and replace `[USER'S OFFER DETAILS GO HERE]` with `body.offerDetails`. Nothing else added, nothing removed.
- Branch the tool-calling schema so the AI returns structured JSON we can render:
  - **Promotional**: existing `return_email` tool (`subject`, `preview`, `header`, `body`, `cta`).
  - **Primary**: new `return_primary_email` tool with fields `subject`, `preheader`, `body`, `cta`. The `body` field contains the full email (greeting through "Best regards, The BitPlay Team") with markdown bold preserved and `\n\n` between paragraphs.
- Reuse the same gateway call, error handling, and newline normalization.

### 2. Frontend — `src/components/EmailGenerator.tsx`
- Add `inboxType` state (default `"promotional"`).
- Add an **Inbox type** selector at the very top of the form (2-option segmented toggle) with short helper text:
  - "Promotional — normal marketing email, spam-safe"
  - "Primary — transactional style, lands in primary inbox"
- When **Primary** is selected: hide the "Audience" selector and "Spam categories" section (the strict prompt does not use them). Keep brand name and extra forbidden words visible (extra forbidden words are **not** injected into the strict primary prompt — that prompt stays verbatim — so we'll grey them out with a small note "Not used in Primary mode").
- Render output cards based on which mode produced the result:
  - Promotional: Subject / Preview / Header / Body / CTA (today's UI).
  - Primary: Subject / Preheader / Body / CTA (no separate header card, body shows markdown bold rendered).
- "Copy full email" works for both shapes.

### 3. No DB / edge function changes
Pure prompt + UI work. No migrations, no secrets needed.

## Files touched

- `src/routes/api/generate-email.ts` — add the verbatim primary prompt constant + inbox-type branching + new tool schema
- `src/components/EmailGenerator.tsx` — add inbox-type selector, conditional fields, dual output rendering
