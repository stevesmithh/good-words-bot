# Email Copy Generaotr

Here's a complete brief you can paste directly into Lovable:

Project Brief: Email Copy Generator

What this app does

A web app that generates promotional emails designed to land in the primary inbox (not spam/promotions). The user fills in offer details, picks their audience, and the app calls the Anthropic Claude API to write a clean, inbox-safe email — subject line, preview text, header, and body.

Tech stack

React + Tailwind CSS

Anthropic Claude API (claude-sonnet-4-5-20251001 or latest Sonnet)

No backend needed — API call goes directly from the frontend

No database, no auth

API call details

Endpoint: POST https://api.anthropic.com/v1/messages

Headers:

Content-Type: application/json
x-api-key: YOUR_API_KEY
anthropic-version: 2023-06-01


Body:

{
  "model": "claude-sonnet-4-5-20251001",
  "max_tokens": 1000,
  "messages": [
    { "role": "user", "content": "<the prompt string>" }
  ]
}


Important: The API key must be stored in an environment variable — never hardcoded. In Lovable, use .env with VITE_ANTHROPIC_API_KEY. Reference it as import.meta.env.VITE_ANTHROPIC_API_KEY in code.

User inputs (the form)

Field Type Notes Offer details Textarea e.g. "Up to $8 free play, up to 35% discount, up to 200 XP, 20 free spins" Audience Dropdown Options: New users, Active users, Inactive users Brand name Text input Optional Extra forbidden words Text input Optional, comma-separated. Added on top of the built-in spam list Spam category toggles Toggle buttons/chips 7 categories — user can turn each on/off

The 7 spam word categories (toggle chips)

Each category has a label and a word list. All are ON by default. Build them as clickable toggle chips. Store which ones are active in state. Only include words from active categories in the prompt.

Category 1 — Financial & money

money, cash, profit, dollar, $$$, income, earnings, payday, revenue, returns, dividend, wealth, rich, millionaire, billionaire, money-making, cash back, cash bonus, cash advance, quick cash, fast cash, easy money, extra income, double your income, triple your income, make money, earn cash, earn money, passive income, investment, invest, payout, grant, financial independence, financial freedom, jackpot, windfall, bet, betting, wager, cheap, discount, bargain, slash prices, no credit check, cheap loan, be your own boss, financial gain, get paid, instant cash, earn, credit


Category 2 — Urgency & pressure

act now, limited time, hurry, urgent, immediate, rush, last chance, today only, expires, offer ends, final, don't miss out, before it's too late, instant access, don't wait, deadline, closing soon, while supplies last, time-sensitive, minutes remaining, seconds left, last minute, expiring, countdown, only a few left, running out, act fast, must end soon, ending soon, don't delay, save now, immediate action, fast action bonus, quick fix, quick gains, must act, must buy, must see, must have, offer expires, hurry now, flash sale, limited spots, now only


Category 3 — Marketing hype

amazing, incredible, miracle, sensational, remarkable, fantastic, tremendous, phenomenal, extraordinary, unbelievable, revolutionary, innovative, breakthrough, state-of-the-art, cutting-edge, next generation, groundbreaking, world-class, award-winning, record-breaking, maximize, optimize, transform, unlock, unleash, skyrocket, explode, dominate, mind-blowing, jaw-dropping, eye-popping, electrifying, breathtaking, awe-inspiring, life-changing, once in a lifetime, never before seen, game-changer, trailblazing, pioneering


Category 4 — Exaggerated promises

guaranteed, risk-free, promise, proven, no obligation, no risk, no hidden, foolproof, never fail, flawless, 100% guaranteed, satisfaction guaranteed, miracle cure, no hassle, no worries, no stress, no problem, painless, all-inclusive, lifetime, results, tested, reliable, unmatched, superior, leading, unbeatable, optimal, perfect, ultimate, risk free, money-back guarantee, no hidden fees, amazing results


Category 5 — Aggressive sales

buy now, special deal, best price, limited offer, exclusive access, special promotion, unique offer, premium, elite, unlimited, complete, unconditional, certified, effective, efficient, powerful, real results, genuine, authentic, shop now, order now, purchase now, special offer, don't miss, exclusive offer, best deal, one time offer, one-day sale, flash sale, save big


Category 6 — Scam & generic

dear friend, congratulations, you've been selected, claim your prize, you have won, lottery winner, click here, download now, apply here, claim your offer, redeem now, access now, activate now, get yours, this is not spam, you are a winner, selected for you, dear homeowner, valued customer, current resident, dear sir, to whom it may concern, official message, you've won, hidden, secret, confidential, insider, underground, offshore, questionable, dubious, shady, fraudulent, scam, fake, deceptive, misleading


Category 7 — Formatting triggers

!!!, $$$, FREE!!!, URGENT, ACT NOW, CLICK HERE, ALL CAPS


Safe replacement map (pass this to the AI in the prompt)

free → complimentary
guaranteed → we stand behind
amazing → solid
incredible → real
exclusive → available to you
limited time → through [date]
act now → when you are ready
buy now → get started
don't miss out → worth a look
last chance → available until [date]
save big → save
best price → competitive pricing
urgent → a note
hurry → when you are ready
jackpot → top reward
win → earn
cash → funds
bonus → extra
deal → offer
discount → reduced price
cheap → cost-effective


The prompt (build this dynamically in code)

You are an expert email copywriter focused on inbox deliverability. Write a short, friendly promotional email that reaches the primary inbox — not spam, not promotions tab.

[Brand: {brandName} — only include this line if brand name was entered]
Audience: {audienceLabel}
Tone: {audienceTone}
Offer: {offerDetails}

REWARD EXTRACTION RULES:
- Read all rewards in the offer carefully.
- Group them by type: free play, discount, XP, free spins, cash, bonus, etc.
- For each type, use the highest value exactly as written in the offer — do not round, do not paraphrase numbers.
- List every reward type in the email body on its own short line.
- Do not skip any reward category.

FORBIDDEN WORDS (do not use any of these — replace with the safe alternatives below):
{comma-separated list of words from active categories + extra words the user typed}

SAFE REPLACEMENTS:
- Instead of "free" → use "complimentary"
- Instead of "guaranteed" → use "we stand behind"
- Instead of "amazing" → use "solid"
[... full list from the safe replacement map above ...]

WRITING RULES:
- Write like a real person talking to a friend. Not a salesperson.
- Every sentence must be 20 words or fewer.
- Use only simple, everyday words.
- No hype, no big promises, no caps lock, no exclamation marks.
- Do not start sentences with "I" or "We" — keep focus on the reader ("you" / "your").
- Vary sentence length. Short is fine.
- No urgency pressure language.

DELIVERABILITY RULES:
- Subject line: under 50 characters, personal curious tone, no "free" as first word, no exclamation marks, no all-caps, must not sound like an ad.
- Preview text: adds new context not in subject, under 90 characters, no pressure language.
- Header: 3–7 words, warm and plain.
- Body: 5–8 sentences. Start with warm opener for the audience. Then list each reward on its own line. End with one soft, low-pressure call to action — no "click here", no "buy now".

OUTPUT: return ONLY valid JSON, no markdown, no explanation, no code fences:
{"subject":"...","preview":"...","header":"...","body":"..."}


Audience tone values to inject:

New users → "Warm, welcoming, gently encouraging. This person just joined — make them feel at home."

Active users → "Friendly and value-focused. Highlight what they gain. Keep them engaged without overselling."

Inactive users → "Gentle and low-pressure. No guilt, no drama. A warm nudge to come back and see what is new."

Parsing the API response

const data = await response.json();
const raw = data.content?.find(b => b.type === 'text')?.text || '';
const clean = raw.replace(/```json|```/g, '').trim();
const parsed = JSON.parse(clean);
// parsed.subject, parsed.preview, parsed.header, parsed.body


Output display

Show 4 sections, each in its own card:

Subject line — with character count shown (warn if over 50)

Preview text — with character count shown (warn if over 90)

Header

Email body

Each card has a Copy button. There is also a Copy full email button that copies all four sections together formatted like:

Subject: ...

Preview: ...

Header: ...

Body:
...


Error handling

If the offer textarea is empty and the user clicks generate → show inline validation message, do not call API

If the API returns a non-200 status → show the HTTP status code in the error message so it's debuggable (e.g. "API error: 401 — check your API key")

If JSON parsing fails → show "Could not parse response" with the raw text in a collapsed detail block

Wrap everything in try/catch

UI notes

Clean, minimal design — white cards, soft borders, plenty of whitespace

The 7 category chips should look like pill-shaped toggle buttons — filled/colored when ON, outlined when OFF

Show a loading spinner or skeleton state while waiting for the API

Mobile responsive

No login, no sidebar, no navigation — single page only

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://good-words-bot.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2d562399-d00f-40a5-a268-08657492d89d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
