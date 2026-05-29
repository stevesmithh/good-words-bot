# Social Copy Generator — Refinement Plan

Applies the 6 issues raised by the SM managers. All changes are scoped to the Social generator (SMS / Email flows untouched).

## 1. Tone enforcement (Issue 1)

- In `src/lib/social-compliance.ts`, replace the current `SOCIAL_TONES` flat list with a per-tone **rulebook**: each tone gets a `label`, `desc`, and a `rules: string[]` block matching the spec (Promotional / Friendly / Informational behaviors — sentence rhythm, emoji policy, banned filler, etc.).
- In `src/routes/api/generate-social.ts`, inject the selected tone's full rulebook into the prompt as its own `TONE RULES` section, and add the "re-read before returning" self-check from the spec.
- Update the tone selector in `src/components/SocialGenerator.tsx` to surface the new tone labels/descriptions (Promotional / Friendly / Informational become the canonical three; existing tones map to them).

## 2. GEO discipline (Issue 2)

- In the prompt builder, replace the current "post MUST reference the GEO" instruction with the spec's **GEO RULE**: no country/region names in body copy; eligibility only as the disclaimer line `Available in eligible locations only.`
- Remove the `detectGeoInText` requirement from the scorer's success path — GEO presence in body is no longer a positive signal; missing-GEO is no longer flagged as a reason.
- Keep `geo` as targeting metadata only (used for routing/log context, not copy content).

## 3. Novelty / timing block (Issue 3)

- Add a `NOVELTY_TERMS` list to `social-compliance.ts` ("just launched", "now live", "introducing", "brand new", "for the first time", "dropping now", "this week only", "don't miss this", "limited time", "act fast", plus "new promotion").
- In the prompt, add the **NOVELTY / TIMING RULE** block. The model may only use novelty language if the user's Core Idea text contains an allow-list trigger word (`new`, `launching`, `just released`, `limited time`, `first time`, `announcing`) — computed server-side and passed into the prompt as `NOVELTY_ALLOWED: true|false`.
- Add post-generation screening: if `NOVELTY_ALLOWED` is false and any novelty term appears in output, mark variant as needing regeneration (see Issue 4 loop).

## 4. Hard compliance blocking (Issue 4)

Two-layer enforcement, replacing today's "auto-rewrite and move on" behavior:

**Layer 1 — input pre-screen (client + server):**
- Add `HARD_BLOCK_INPUT_TERMS` to `social-compliance.ts` (guaranteed win/earn, instant payout/withdrawal, risk-free, free money, no risk, you will win, certain to win, 100% win, always pays out, etc.).
- In `SocialGenerator.tsx`, scan the Core Idea + Promotion fields on change. If a hit is found, show an inline red banner listing the term and its safer alternative, and **disable** the Generate button until the user edits the text. Server re-validates and rejects with 400 if bypassed.

**Layer 2 — output hard-block + regenerate:**
- Add `HARD_BLOCK_OUTPUT_PATTERNS` (regexes for `guaranteed (win|earn|reward|return|payout)`, `risk[- ]?free`, `instant (payout|withdrawal|cash|win)`, `free money`, `no risk`).
- After the model returns, run these regexes. If a variant hits, do **not** auto-rewrite — discard it and call the model again with an appended instruction `The previous output contained a blocked compliance term: "<term>". Do not use it or any semantic equivalent.` Up to 2 retries; if it still fails, return the variant marked `blocked: true` with no copy shown (UI renders a "Could not produce compliant copy — refine your brief" card).
- Keep `autoRewriteHighRisk` only for the lower-risk medium-vocab list, not for the hard-block list.

## 5. Anti-fabrication (Issue 5)

- Add explicit, structured inputs to `SocialGenerator.tsx`:
  - `offerName` (text, optional)
  - `offerAmount` (text, optional — e.g. "$20 credit", "100 free spins")
  - `promoCode` (text, optional)
  - `gameTitles` (text, optional)
- Pass each as either the literal value or the sentinel string `NOT PROVIDED — do not include` into the prompt under a `BRIEF FACTS` block.
- Add the spec's **FABRICATION RULE** block to the prompt, plus a tool-call field `details_used: string[]` the model must populate listing every concrete fact it referenced.
- Server validates: any token in `details_used` that isn't in the supplied facts fails the variant (regenerate). Any `$`, `%`, or all-caps code-shaped token (`/[A-Z0-9]{4,}/`) in the output that isn't in the supplied facts also fails.

## 6. Explainable compliance audit (Issue 6)

- Extend the Claude tool schema so each variant returns:
  ```
  copy, hashtags,
  compliance_audit: [{ original_term, replacement, reason, risk_level, rule_reference }],
  overall_risk_score: "Low"|"Medium"|"High",
  risk_score_reason: string,
  missing_elements: string[]
  ```
- Merge the model's audit with the server's own findings (hard-block hits, fabrication catches, novelty catches) so the audit is authoritative, not just the model's self-report.
- In `SocialGenerator.tsx`, render a collapsible **Compliance Report** beneath each variant:
  - Risk badge (green/yellow/red) using existing tokens.
  - Audit cards: `original_term` in destructive color → `replacement` in success color → `reason` in muted text → risk badge.
  - `missing_elements` rendered as warning chips; copying to clipboard is gated behind an "Acknowledge warnings" checkbox when any chip is present.

## Files touched

- `src/lib/social-compliance.ts` — tone rulebooks, hard-block lists, novelty terms, output regexes, new audit types.
- `src/routes/api/generate-social.ts` — new prompt blocks (tone, GEO, novelty, fabrication, audit), retry loop on hard-block hits, server-side validators, expanded tool schema.
- `src/components/SocialGenerator.tsx` — structured brief fields, input pre-screen banner, tone label refresh, Compliance Report panel, acknowledgement gate.
- No DB migrations, no changes to SMS/Email generators, no changes to short-link API.

## Out of scope

- SMS and Email generators (managers' notes are SM-specific).
- Catalog / promotions schema changes — new fields live on the generator form only.
- Multilingual tone rules — English copy only for this pass.

## Open question

The current tone list is `fun / informative / community / hype / soft`. The spec uses `promotional / friendly / informational`. Plan is to **replace** the current tones with the spec's three (cleaner, matches managers' language). If you'd rather keep all five and just add the three new ones, say so before implementation.
