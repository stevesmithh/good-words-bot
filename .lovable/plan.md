# Add short.io short links to SMS generator with reuse tracking

Each SMS generation picks a promotion (UTM) from a dropdown, gets a short.io short link for that UTM, appends the same link to all 6 variants, and tracks which variant the user actually used via a checkmark. Unused links are reused on the next generation for the same UTM until one is marked used.

## What you'll need to give me

1. **The UTM list** — paste it in chat. Each entry needs:
   - Promotion name (what shows in the dropdown, e.g. "Daily Wheel Spin")
   - Full destination URL with UTM params (e.g. `https://site.com/promo?utm_source=sms&utm_campaign=wheel`)
2. **Short.io API key** — I'll request it as a secret (not stored in code).
3. **Short.io domain** — the branded domain you use in short.io (e.g. `yourbrand.short.gy`). If you only have one, I'll just hardcode it.

## How it will work end-to-end

```text
User picks promotion from dropdown ──► Generate SMS
                                        │
                                        ▼
                     Server checks Lovable Cloud DB:
                       any UNUSED short link for this UTM?
                                        │
                          ┌─────────────┴─────────────┐
                          │ YES                       │ NO
                          ▼                           ▼
                   Reuse that link            Call short.io API,
                                              create new short link,
                                              save to DB as "unused"
                                        │
                                        ▼
                Append the SAME short link to all 6 variants
                                        │
                                        ▼
                Each variant card shows a ✓ checkmark button
                                        │
                                        ▼
                User clicks ✓ on the variant they sent
                       → marks short link as "used" in DB
                       → next generation creates a fresh link

           If user generates again WITHOUT clicking any ✓:
                       → same unused short link gets reused
                         on the new batch (still 6 variants)
```

## UI changes

**SMS form (left side)**
- New required field at top: **Promotion** dropdown (lists all UTMs from the hardcoded list).
- The existing "CTA link" field is removed for SMS — the short link is derived from the chosen promotion. (Email generator is untouched.)

**SMS results (right side)**
- Each of the 6 variant cards gets a new **green checkmark button** next to the copy button.
- Clicking the checkmark:
  - Marks that short link as "used" in the DB
  - Visually fills the checkmark + disables it
  - Shows a small "Used — next generation will create a new link" hint
- A small badge under each card shows the short link and whether it's `Fresh` or `Reused from previous batch`.

## Technical pieces

**New files**
- `src/lib/promotions.ts` — hardcoded array `[{ id, name, destinationUrl }]`. You'll send the list, I'll fill it in.
- `src/routes/api/shortio.ts` — server route. Two handlers:
  - `POST /api/shortio/get-or-create` — input: `{ promotionId }`. Looks up unused link in DB → reuses or creates via short.io API → returns `{ shortUrl, linkId, isReused }`.
  - `POST /api/shortio/mark-used` — input: `{ linkId }`. Sets `used_at = now()` in DB.

**Edited files**
- `src/components/SmsGenerator.tsx` — add Promotion dropdown, remove CTA link input, fetch short link before calling generator, pass it to the API, render checkmark buttons + "fresh/reused" badge.
- `src/routes/api/generate-sms.ts` — accept the resolved `shortUrl` from the client (it just appends it to each variant; logic already supports a CTA link).

**Lovable Cloud (database)**

Enabling Lovable Cloud (free) for one table:

```sql
create table public.sms_short_links (
  id uuid primary key default gen_random_uuid(),
  promotion_id text not null,
  destination_url text not null,
  short_url text not null,
  shortio_id text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create index on public.sms_short_links (promotion_id, used_at);
```

No auth/RLS needed — internal tool, single user. Table is read/written only by server routes using the service role key.

**Secret**
- `SHORTIO_API_KEY` — added via the secrets tool after you confirm the key.

## Edge cases handled

- **Short.io API down or returns error** → generation still works, falls back to the raw destination URL with a toast warning.
- **DB has multiple unused links for the same UTM** (shouldn't happen, but possible if checkmark is never clicked across many sessions) → reuses the oldest unused one.
- **User changes promotion mid-generation** → fresh fetch for the new promotion.
- **Variant text already contains a link from a previous generation** → not an issue; we only append once at API-response time.

## What stays the same

- Email generator: untouched.
- All existing SMS spam-word filtering, casual/standard variant logic, "no code word" rules: untouched.
- Six-variant output, character/segment counts, copy buttons: untouched (just gain a checkmark sibling).

## Open thing I'll confirm before building

Once you paste the UTM list + short.io key + branded domain, I'll:
1. Enable Lovable Cloud and create the `sms_short_links` table.
2. Add the `SHORTIO_API_KEY` secret request.
3. Implement the routes + UI changes above.

Approve this plan to switch into build mode, then send me the UTM list, short.io API key, and branded short.io domain.
