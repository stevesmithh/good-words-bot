# Social tab: core-idea input, custom links, short-link automation

Three changes to `SocialGenerator` + supporting backend, plus copywriting recommendations baked into the generator.

## 1. Core-idea / promotion brief box (required)

Today the form has an optional "Topic / angle". Promote it to a **required** input renamed **"What are you promoting? Core idea & angle"**, with a longer textarea (4 rows) and a helper line: _"One or two sentences. What's the offer? Who's it for? What's the hook?"_

- Required — Generate button stays disabled until both Promotion (or custom link, see §2) AND this box are filled.
- Sent as `topic` to `/api/generate-social` (already wired). We'll also tighten the platform prompt so the LLM treats this as the authoritative angle, not optional flavor.

## 2. Link source: Ready promotion **or** Manual link

Add a small segmented control above the Promotion field:

- **Ready promotion** (current behavior — pick from the dropdown of pre-saved promotions for the selected site).
- **Manual link** — two inputs:
  - **Site** — Select (reuses the site list, used purely to pick the short domain).
  - **Destination URL** — text input, validated as a URL.
  - Member also fills a free-text **Link label** (e.g. "Weekend tournament page"), used as the `promotionName` sent to the LLM.

The same `siteId`/site short-domain logic is reused — no schema change to `sites` or `promotions`.

## 3. Auto-create short links for social, tagged `sm`

When the form is submitted, the client (or the new server route) first resolves a short link, then sends `promotionUrl = <shortUrl>` into `/api/generate-social` so the LLM embeds the short link on platforms where links are allowed (Facebook, X, Telegram — TikTok/Instagram captions still link-free per existing compliance rules).

Implementation:

- **Extend `sms_short_links` with a `channel text not null default 'sms'` column** (migration). Reuse the table to avoid a parallel schema; rows for social use `channel = 'social'` and `utm_medium = 'social'`.
- **Add `/api/social-shortlink`** (new TanStack server route, mirrors `/api/shortio` but for social):
  - Inputs: either `{ promotionId }` (ready) or `{ siteId, destinationUrl, label }` (manual).
  - Builds `utm_source = <platform-or-"social">`, `utm_medium = 'social'`, `utm_campaign = <random slug>`.
  - Calls short.io with `tags: ["sm"]` (was `["sms"]` for SMS).
  - For ready promotions: reuses unused rows scoped by `channel='social'` + current short_domain (same reuse logic as SMS).
  - For manual links: always creates a fresh short link (no reuse — destination is arbitrary per submission) and stores it with `promotion_id = NULL` (requires loosening that column to nullable in the migration) plus a new nullable `manual_label text` column for traceability.
- **`SocialGenerator`** calls `/api/social-shortlink` before `/api/generate-social`, then injects the returned short URL as `promotionUrl`. One short link per generation submission — same link reused across the platforms in that submission.

Per-platform link policy already enforced in `social-compliance.ts` (`allowLink`) stays the rule of truth: Instagram still says "link in bio", TikTok still strips URLs.

## 4. Copywriting recommendations (in-product)

Surface them as a small **"Tips for higher-converting safe posts"** collapsible under the form, plus bake them into the system prompt so the LLM follows them by default:

- Lead with curiosity, not the offer. ("Something new just landed for weekend players." > "Get bonus now.")
- One concrete detail beats five vague ones — name the game, the tournament, the date.
- Pose a question in the first line on FB/IG to lift comment rate.
- On X, write like a person, not a brand — lowercase, short, one idea.
- On Telegram, lead with the value, end with the link, no emoji wall.
- On TikTok captions, treat copy as a hook for the video — under 150 chars, no link, no urgency.
- Mention GEO naturally ("Live in NJ / PA / MI") not as a disclaimer dump.
- Always end with the platform-appropriate responsible-play line (already auto-appended).

## Technical summary

**Files to edit / create**
- `supabase/migrations/<ts>_social_short_links.sql` — add `channel`, `manual_label` columns; loosen `promotion_id` to nullable; backfill `channel='sms'`; keep RLS as-is.
- `src/routes/api/social-shortlink.ts` (new) — handles ready + manual modes, calls short.io with `tags: ["sm"]`.
- `src/routeTree.gen.ts` — auto-regenerated.
- `src/components/SocialGenerator.tsx` — link-source toggle, manual-link inputs, required core-idea box, tips accordion, shortlink fetch step.
- `src/routes/api/generate-social.ts` — accept `promotionUrl` as-is (already does), tighten prompt to treat `topic` as required core idea; add the copywriting tips to the system prompt.

**Out of scope**
- Editing pre-saved promotions (still done via Admin).
- Per-platform unique short links (single short link reused across platforms per submission — keeps short.io usage and tracking simple).
- Changing SMS behavior — `/api/shortio` and its `tags: ["sms"]` stay untouched.

## Open question

For **manual links**, should we keep the rule that a manual destination URL must live on the selected site's domain (safer — prevents using the short domain for arbitrary third-party URLs), or allow any URL? Default in this plan: **allow any URL**, since the use case is "team member has a landing page not yet in the catalog". Tell me if you want it restricted.
