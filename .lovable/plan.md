
# Add SMS Copy Generator (bulk SMS, US-focused)

A second tool alongside the email generator for short bulk-SMS copy. Uses the same architecture: server route + Lovable AI Gateway + tool-calling for structured output.

## Navigation

Add a top-of-page tab switcher on `/` so the user can flip between **Email** and **SMS** without a full second route. Keeps the single-page, no-nav app structure intact.

```text
[ Email ]  [ SMS ]
```

## SMS form (left side)

- **SMS type** — 4 segmented buttons:
  1. Promotional (no code)
  2. Deposit coupon code
  3. Deposit bonus (1st / 2nd / 3rd)
  4. Signup promo code
- **Conditional fields** based on type:
  - *Deposit coupon code* → `Coupon code` text input (required), `Bonus description` (e.g. "100% up to $200")
  - *Deposit bonus* → dropdown for "1st / 2nd / 3rd deposit", `Bonus amount or %` input, optional `Coupon code`
  - *Signup promo code* → `Promo code` (required), `Free play reward` input
  - *Promotional* → just the offer description
- **Offer details** — short textarea, required (placeholder explains "what we are giving and any context")
- **Audience** — New / Active / Inactive (same as email)
- **Brand name** — optional
- **CTA link** — required, the URL appended at the end (validated as URL). The model treats it as a token, never rewrites it.
- **Length target** — radio: "Short (under 160 chars / 1 segment)" or "Standard (10–15 words + link)". Default: Short.
- **Spam category toggles** — pill chips, all on by default (see categories below)
- **Extra forbidden words** — comma-separated input
- **Generate SMS** button

## SMS spam-word categories (US-focused)

Stored in `src/lib/sms-spam-words.ts`. Built from the user's list plus standard US carrier (AT&T / Verizon / T-Mobile) filter triggers researched and added:

1. **Financial & payments** — payment, withdraw, usd, cash, payslip, debit card, chase, bank, wire, deposit*, payout, ach, zelle, venmo, paypal, account, credit, loan, refund, tax
2. **Crypto** — coin, coinbase, btc, bitcoin, eth, crypto, wallet, blockchain, nft, token
3. **Work / income bait** — job, remote, hiring, work from home, side hustle, earn, salary, payslip, profitable, base
4. **Prizes & gambling** — sweepstakes, lottery, jackpot, winner, prize, casino, bet
5. **Discounts & urgency** — reduction, discount, % off, sale, limited time, expires, act now, hurry, last chance, today only
6. **Generic spam triggers** — click here, click link, free, congratulations, claim, verify, suspended, locked, alert, urgent, code (when not paired with the user's coupon/promo field)
7. **Geography flags** — USA, US-only (carriers flag these in promotional context)
8. **Formatting triggers** — ALL CAPS words, $$$, !!!, repeated punctuation

*Coupon/promo code values entered by the user are passed through as-is and explicitly marked safe in the prompt — they never get filtered.

I'll also research current US SMS-spam trigger lists during build (web search) and merge anything common that isn't already covered.

## Output (right side)

Just two cards (SMS is short — no subject/preview/header):

1. **SMS message** — full text including the link at the end
   - Live character count + segment count (1 segment = 160 chars GSM, 2 = 306, 3 = 459)
   - Color: green ≤160, amber 161–306, red >306
   - Copy button
2. **Variants** — 2 alternate phrasings of the same message so the team can A/B or rotate (helps avoid carrier dedupe filtering on bulk sends)
   - Each with its own copy button
   - Each with its own char/segment count

Plus a **Copy all variants** button.

## Prompt rules (server-side)

- Max 15 words for the message text, link counted separately and appended at the end exactly as provided.
- Single sentence or two short ones — natural human tone, no marketing voice.
- Must include the coupon/promo code verbatim when provided, formatted clearly (e.g. `Code: WELCOME50`).
- For deposit bonus: include the bonus value the user entered, as written.
- Never use any forbidden word (active categories ∪ extras), but allow user-provided code values to pass.
- No "click here", no "free", no all-caps words, no `!!!`, no `$$$`.
- Link goes at the very end, preceded by a single space, no trailing punctuation.
- Return three options via tool calling: `{ message, variantA, variantB }`.

## Files

- **New**: `src/lib/sms-spam-words.ts` — categories + safe replacements
- **New**: `src/routes/api/generate-sms.ts` — server route, tool-calling, same error handling pattern as email (429, 402, parse failures with raw collapsible)
- **New**: `src/components/SmsGenerator.tsx` — the SMS form + output
- **New**: `src/components/EmailGenerator.tsx` — extracted from current `index.tsx` (just a refactor — same code, same behavior)
- **Edit**: `src/routes/index.tsx` — replace body with a Tabs (`Email` / `SMS`) wrapper that renders the two components. Header stays the same but title becomes "Copy Generator".
- **Edit**: `src/routes/__root.tsx` — page title → "Copy Generator"

## Error handling

Same as email: inline validation, toast on API errors, 429 / 402 friendly messages, collapsible raw response on parse failure.

## Result

One page, two tabs. Email tool stays exactly as it is. SMS tool produces a tight 10–15 word message + the user's link, scrubbed of US carrier spam triggers, with two extra variants for rotation, plus full coupon/bonus/signup-code support.
