
# Email Copy Generator

A single-page web app that generates inbox-safe promotional emails using AI, with built-in spam-word filtering.

## Architecture
- Single page (`/`) — no auth, no database
- AI calls go through a TanStack server route (`/api/generate-email`) using Lovable AI Gateway with `google/gemini-3-flash-preview` (fast + high quality, no API key setup needed, key stays server-side)
- All spam-word lists, the safe replacement map, and the prompt template live on the server so they can be tuned without touching the client

## Form (left side / top on mobile)
- **Offer details** — textarea, required (inline validation if empty)
- **Audience** — dropdown: New users / Active users / Inactive users
- **Brand name** — optional text input
- **Extra forbidden words** — optional, comma-separated
- **Spam category toggles** — 7 pill-shaped chips, all ON by default, filled when active / outlined when off:
  1. Financial & money
  2. Urgency & pressure
  3. Marketing hype
  4. Exaggerated promises
  5. Aggressive sales
  6. Scam & generic
  7. Formatting triggers
- **Generate email** button (shows spinner / disables while loading)

## Output (right side / below on mobile)
Four white cards with soft borders, each with its own **Copy** button:
1. **Subject line** — with live character count, red warning if > 50
2. **Preview text** — with live character count, red warning if > 90
3. **Header**
4. **Email body**

Plus a **Copy full email** button that copies all four formatted as:
```
Subject: ...
Preview: ...
Header: ...

Body:
...
```

## Prompt logic (server-side)
Builds the prompt dynamically per the brief:
- Audience tone string injected based on selection
- Forbidden words = union of words from active categories + user's extras
- Full safe replacement map included
- Reward extraction rules + writing/deliverability rules included
- Asks the model to return ONLY JSON `{subject, preview, header, body}` — uses tool calling for reliable structured output (more robust than regex-stripping markdown)

## Error handling
- Empty offer → inline validation, no API call
- API non-200 → toast + inline error showing status code
- Parse failure → "Could not parse response" with a collapsible details block showing raw text
- 429 (rate limit) and 402 (out of credits) → friendly toast explaining what to do

## Design
- Clean, minimal, lots of whitespace
- White cards, soft borders, neutral palette with one accent color for active chips & primary button
- Mobile responsive — form stacks above output on small screens
- Loading state: skeleton cards in the output area while generating
