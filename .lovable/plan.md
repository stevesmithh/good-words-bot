# Add "Non-Spam" SMS type (transactional-style copy)

Add a new SMS type that produces messages reading like a transactional account notification rather than a promo. Goal: maximize pass-through on US carrier spam filters (AT&T, Verizon, T-Mobile).

## What the user picks

In the existing SMS Type selector (alongside Promotional / Deposit coupon / Deposit bonus / Signup promo) add:

- **Non-Spam** — Transactional-style account message, max carrier-safe

When selected, the form keeps the same fields but:
- Brand name field is hidden (brand is intentionally not mentioned)
- Promo code field is shown (and required) — the code is the only "marketing" element kept
- Bonus % / freeplay field is shown but optional, and used as a *neutral reference* only (e.g. "tier 40 credit") — never with `$`, `%`, "bonus", "free"

## Content rules for Non-Spam

Every variant must read like a balance/account notification. Style references:

- "A balance enhancement is currently available on your account. Apply MEGAGEM40 to continue: link"
- "Your account is eligible for an additional balance credit today. Use MEGAGEM40 during checkout. Access: link"
- "Your profile currently qualifies for an adjusted credit allocation. Reference: MEGAGEM40 - link"

Hard constraints layered on top of existing forbidden-word logic:

- Tone: account/system notification. Neutral, factual, third-person. No casual/slang variants.
- No brand name. No emoji. No exclamation marks. No urgency.
- Forbid (in addition to existing list): `bonus`, `free`, `freeplay`, `deposit`, `win`, `winner`, `cash`, `prize`, `reward`, `gift`, `offer`, `promo`, `promotion`, `discount`, `exclusive`, `limited`, `claim`, `unlock`, `congratulations`, `eligible to win`, `$`, `%`, ALL CAPS words (other than the promo code itself).
- Allowed neutral vocabulary: "balance", "account", "credit", "allocation", "adjustment", "enhancement", "tier", "reference", "profile", "qualifies", "eligible", "available", "apply", "use", "access", "continue".
- Promo code MUST appear verbatim, referenced naturally ("apply MEGAGEM40", "use MEGAGEM40", "reference: MEGAGEM40"). The word "code" is already globally forbidden — that stays.
- If bonus value is provided, encode it as a neutral reference like "tier 40 credit" / "level 40 allocation" — never "40% bonus" or "$40 free".
- Link sits at the end after a single space or `:` / `-` separator (the example uses both — allow either).
- Length: under 200 chars total including link.

## Variants returned

For Non-Spam, return SIX variants in the same shape as today, but all six use the transactional account-notification style — no casual variants. Each variant uses a different opening structure so carriers don't dedupe:

- `message` — "A balance enhancement is currently available on your account..."
- `standardA` — "Your account is eligible for..."
- `standardB` — "Your profile currently qualifies for..."
- `casualA` — "An adjusted credit allocation has been applied to your account..."
- `casualB` — "A pending balance update is available for your review..."
- `casualC` — "Your account currently has an active credit reference..."

(Field names stay the same so the existing UI rendering keeps working — only the content style changes for this type.)

## Technical changes

1. `src/routes/api/generate-sms.ts`
   - Extend `SmsType` union with `"non_spam"`.
   - Add a `case "non_spam"` branch in `buildPrompt` with the transactional rules above and the extended forbidden list.
   - Skip the casual VOICE / DIVERSITY blocks for `non_spam`; replace with a TRANSACTIONAL VOICE block.
   - Validation: require `promoCode` for `non_spam`.

2. `src/components/SmsGenerator.tsx`
   - Add `"non_spam"` to `SmsType` and to `SMS_TYPES` with label "Non-Spam" and desc "Transactional, carrier-safe".
   - Show the promo code input when `smsType === "non_spam"` (reuse existing `promoCode` field & error key).
   - Optional: show a small helper note under the type tile when selected.
   - Hide the brand name field when `non_spam` is selected (or just don't send it).
   - In the submit payload, send `smsType: "non_spam"` and the promo code.

3. No DB / no API key changes.

## Out of scope

- No changes to email generation.
- No new variant slots — keep the existing 6-variant shape so output rendering stays untouched.
