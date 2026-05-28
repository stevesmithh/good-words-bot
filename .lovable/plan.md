## Goal

Add a third tab to the Copy Generator (alongside Email and SMS) called **Social Media**. The team enters a site/brand, promotion, target GEO, tone, and an optional free-text topic; the generator returns **3 variants per platform** for Facebook, Instagram, X, TikTok, and Telegram — each one safe under the iGaming compliance rules in the uploaded PDF, but written to feel engaging and human, not robotic.

## What the team will see

A new "Social" tab in the top tab switcher. The form mirrors the SMS generator's familiar shape:

- Site / brand selector (reuses existing `sites` + `promotions` catalog)
- Promotion selector (reuses existing catalog)
- Target GEO (free text, e.g. "US – NJ, PA, MI", "Canada", "Global ex-US")
- Tone selector: Fun & playful · Informative · Community · Hype · Soft brand
- Free-text topic / angle (optional, e.g. "weekend tournament", "new game spotlight")
- Platform checkboxes (Facebook, Instagram, X, TikTok, Telegram) — all on by default, must keep ≥1
- Generate button

Output: one card per selected platform, each with **3 variants**. Every variant shows:
- The post copy (with appropriate length/format for that platform)
- Suggested hashtags (where the platform expects them) and an optional emoji set
- A **risk badge** — Low / Medium / High — based on the PDF's scoring logic
- Why it scored that way (1 short line, e.g. "Soft CTA, disclaimer present, GEO clear")
- Copy button (and "Copy with disclaimer" where applicable)

## Compliance behavior (strict mode)

Driven by `src/lib/social-compliance.ts` (new), built from the PDF:

- **Banned / High-risk terms** are never emitted. If the model produces one, the server auto-rewrites it using the PDF's safer-alternatives table (e.g. "play now" → "explore details", "deposit now" → "check offer terms", "win big" → "explore what's available", "free money" → "welcome offer, T&Cs apply", "cash out" → "manage your session responsibly", "bonus code" → "offer details", "jackpot tonight" → "game feature spotlight"). After rewrite the variant is re-scored.
- **Medium-risk terms** (bonus, deposit bonus, reload, jackpot, lucky, cash, payout, spin, VIP win, free credits, reward, claim) are allowed at most once per post and only when softened with a disclaimer; otherwise the model is asked to retry.
- **Disclaimers** auto-appended where the platform allows length: `21+. T&Cs apply. Play responsibly. Available in eligible locations only.` For X (character-tight) we use a compact form: `21+ · T&Cs apply · Play responsibly`.
- **Platform link/CTA rules** (per PDF):
  - **TikTok**: organic-only — no direct deposit CTA, no real-money gambling link, no win promises. Variants steer toward "community update / game feature / responsible play" angles.
  - **Telegram**: treat as organic; no urgency, no "you just won", no aggressive bonus/deposit/jackpot language. We do not emit a deposit link; a soft brand link is allowed only when the promotion permits.
  - **X**: no affiliate codes, no betting CTAs, no promo codes. Brand update / community question / responsible-gaming reminder style.
  - **Meta (FB / IG)**: soft CTAs only ("Explore details", "Check eligibility"). Never "play now / deposit now / claim now / win now". GEO must be explicit when the promotion is US-restricted — we surface GEO into the post (e.g. "Available in NJ, PA, MI.").
  - **YouTube** is intentionally **not** included in v1 — the PDF requires per-country gambling certification we cannot verify here. (Easy to add later as a separate, more restricted generator.)
- **Risk scoring** per PDF section 8:
  - **Low**: soft copy, disclaimer present, GEO clear, safe CTA, no win claim.
  - **Medium**: contains medium-risk vocab but disclaimer + GEO present.
  - **High**: any banned term survives a rewrite pass, missing GEO on US iGaming, or a forbidden CTA — these variants are dropped and regenerated (up to 2 retries), and if a variant is still High it is returned with the badge clearly visible but flagged "manager review required".

## Variant diversity (reuse the SMS approach)

Reuse the seed/variation pattern from `src/server/sms-variation.server.ts`:

- A new `src/server/social-variation.server.ts` with per-platform opener pools, sentence shapes, tone modifiers, emoji policies (TikTok/IG more emoji-friendly; X/Telegram restrained).
- Recent-output memory in a new `recent_social_outputs` table keyed by `(site_id, platform, tone)` so the next generation is told NOT to mirror the last ones — same Dice-coefficient near-duplicate guard already used for no-spam SMS.

## Architecture

- **Frontend**
  - `src/components/SocialGenerator.tsx` — form + result cards (mirrors `SmsGenerator.tsx`).
  - `src/routes/index.tsx` — add third tab "Social" with an icon.
- **Server**
  - `src/routes/api/generate-social.ts` — TanStack server route. Validates input with zod, fans out per selected platform in parallel, runs the rewrite + rescore loop, persists recent outputs.
  - `src/server/social-variation.server.ts` — seeds, opener pools, prompt blocks.
  - `src/lib/social-compliance.ts` — banned/medium lists, safer-alternative map, disclaimer templates, per-platform policy + risk scorer (shared client/server so the UI can re-score on edits later).
  - `src/server/anthropic.server.ts` — reused as-is (Gemini Flash via Lovable AI Gateway), with a per-platform tool schema so the model returns structured `{ copy, hashtags, emojis }` per variant.
- **Database** (one new migration)
  - `recent_social_outputs(id, site_id, platform, tone, text, created_at)` — same shape and RLS posture as `recent_sms_outputs` (no public access; server uses service role).

## Performance

- Target ≤ 60 s end-to-end with all 5 platforms selected.
- Run the 5 platform calls in parallel; each platform is a single model call returning all 3 variants in one tool call (same pattern as SMS).
- The rewrite/rescore pass runs server-side without an extra model call when fixes are mechanical (token swap). Only retry the model if a variant still scores High after rewrite.

## Out of scope for v1

- YouTube, LinkedIn, Reddit, Threads (deferred — YouTube specifically blocked by the PDF's certification requirement).
- Direct posting to the platforms (we only generate copy; team posts manually).
- Image / video generation.
- Hashtag research from external APIs (we use a curated, compliance-safe pool per platform).

## Acceptance checks

1. Banned phrase test: ask for a "play now" CTA — output never contains "play now / deposit now / claim now / win now / win big / free money / bonus code / jackpot tonight" etc.
2. GEO test: with promotion marked US-only and GEO left blank, Meta variants are rejected as High until GEO is added.
3. TikTok test: TikTok variants never include a deposit link or "claim bonus".
4. Telegram test: no urgency words ("now", "hurry", "last chance", "you just won").
5. Repeat test: generating twice in a row for the same site/platform produces meaningfully different openers (Dice < 0.86 vs. last 5).
6. Speed test: 5 platforms × 3 variants returns in under 60 s.
