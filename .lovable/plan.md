# Make every SMS generation feel unique

## Problem
The team generates SMS daily with the same site / promotion / SMS type. Right now each run starts from the same prompt with no randomness and no awareness of what was sent before, so outputs cluster around the same openers, sentence shapes, and emoji choices. Over a week it reads like the same handful of messages on repeat.

## Goal
Each generation — even with identical inputs — should feel meaningfully different from the previous runs of the same team, while still following all spam-safe and length rules.

## Approach
Three layers of variation, stacked:

### 1. Model-level randomness
- Raise the model's creativity dial (`temperature` ~1.0, `top_p` ~0.95) on the AI gateway call. Right now no temperature is passed, so the model behaves near-deterministic.

### 2. Per-request creative seed
For every generation, the server randomly picks fresh "creative ingredients" and bakes them into the prompt:
- A different shuffled opener pool for each of the 6 (Standard + Casual) variants, drawn from a much larger master pool.
- A rotated "sentence shape" hint per variant (e.g. "start with a question", "two short fragments", "single statement", "imperative line", "two-clause sentence with em-dash").
- A rotated micro-tone modifier (e.g. "playful", "matter-of-fact", "warm", "low-key", "curious", "direct").
- A rotated emoji policy (none / single optional / one specific allowed emoji from a rotating set).
- A small random "vibe word" that flavors the message without being mandatory.

Because the seed differs every call, the prompt itself differs every call, which materially changes output even at the same temperature.

### 3. Memory of recent outputs (anti-repetition)
Persist the texts of the last ~30 generations per `(site_id, sms_type)` and feed the most recent 15 back into the prompt as a "RECENT SENDS — do NOT mirror these openers, phrasings, sentence shapes, or emoji" block. The model is explicitly told these are off-limits as templates.

This is the single biggest win: it directly addresses "the texts are very similar each day", because the model literally sees yesterday's outputs and is told to diverge.

Also applies to the No-Spam group on its own track (its own recent-sends memory).

## Technical details

### Database
New table `recent_sms_outputs`:
- `id uuid pk`
- `site_id text` (nullable — falls back to global)
- `sms_type text` (`promotional` | `deposit_coupon` | `deposit_bonus` | `signup_promo` | `non_spam`)
- `variant text` (`standard` | `casual` | `nospam`)
- `text text`
- `created_at timestamptz default now()`
- Indexes on `(site_id, sms_type, created_at desc)` and a TTL-style cleanup keeping only the last 50 rows per group (done lazily on insert).
- RLS: no public access (server-only via service-role client, same pattern as `generation_events`).

### Server changes (`src/routes/api/generate-sms.ts`)
- Add `seedCreative(input)` helper that returns: per-variant opener pool, sentence shape, tone, emoji policy, vibe word — all chosen by `Math.random()` from large master lists.
- Add `fetchRecentTexts(site_id, sms_type, variantGroup, limit=15)` using the service-role client.
- Add `saveRecentTexts(site_id, sms_type, variantGroup, texts[])` after a successful generation (fire-and-forget, do not block response).
- Modify `buildPrompt` to:
  - Accept the creative seed and inject a "VARIATION SEED" block listing each variant's chosen opener pool, shape, tone, emoji policy.
  - Inject a "RECENT SENDS — avoid mirroring" block with the fetched recent texts.
- Update `callClaudeWithTool` (or pass options through) to send `temperature: 1.0` and `top_p: 0.95`.
- Same memory + seed mechanism wired for the parallel No-Spam call, scoped to `variant=nospam`.

### Master pools (server-only constants)
- ~30 standard openers, ~40 casual openers (curiosity / friend-rec / fyi each get their own larger pool), ~12 No-Spam opening structures.
- ~8 sentence shapes, ~8 tone modifiers, ~6 emoji policies, ~25 vibe words.

### No UI changes
This is entirely server-side. The form stays as-is and the output area stays as-is — the messages it shows just stop repeating themselves.

## Out of scope
- No change to the SMS type picker, the No-Spam rendering, the short-link flow, or the length / spam-category controls.
- No global "regenerate with more variation" button — variation becomes the default.
- No per-user memory (anti-repetition is per site + sms_type, shared across the team, which matches how they actually send).
