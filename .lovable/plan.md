## Goal

Add an **Admin Editor** accessible via a button in the top-right corner of the SMS Generator. Clicking it asks for a **4-digit code (`2026`)**, then opens a full editor where you can:

- **Sites**: rename a site, change its short.io domain (e.g. swap `dr0p.cc` to a new domain), add or remove a site.
- **Promotions**: edit name, destination URL, site, and per-promotion short domain override; add or delete promotions.
- **SMS Providers**: add/remove provider names (currently SMSEdge, Dexatel, Laaffic).

All changes are saved to the database and reflected immediately in the dropdowns.

---

## How it will work (user view)

1. A small **gear/edit icon** appears in the top-right corner of the dashboard.
2. Click it → modal asks for the **4-digit access code**. Enter `2026` → editor opens.
3. The editor is a tabbed dialog with three tabs: **Sites**, **Promotions**, **SMS Providers**.
4. Each tab is a table with inline editing (name, domain, URL) plus **Add** and **Delete** buttons.
5. Saving a row writes immediately to the database; the SMS generator picks it up on the next refresh.
6. The code stays valid for the browser session so you don't get re-prompted on every open.

---

## Technical plan

### 1. Database (3 new tables)

- `sites` — `id (text PK)`, `name`, `short_domain`, `created_at`
- `promotions` — `id (text PK)`, `site_id (FK)`, `name`, `destination_url`, `short_domain_override (nullable)`, `created_at`
- `sms_providers` — `id (uuid PK)`, `name (unique)`, `created_at`

RLS: enable RLS on all three; allow public `SELECT` (so the dropdowns work without login) and **block all writes** at the RLS layer. Writes happen only via server functions that check the admin code (defense in depth — never trust the client).

A one-time migration seeds these tables from the existing `src/lib/promotions.ts` constants (6 sites, 3 providers, ~140 promotions).

### 2. Admin server functions (`createServerFn`)

A single file `src/lib/admin.functions.ts` exposes:

- `verifyAdminCode({ code })` → returns `{ token }` if `code === ADMIN_CODE` env secret, else throws.
- `adminUpsertSite`, `adminDeleteSite`
- `adminUpsertPromotion`, `adminDeletePromotion`
- `adminUpsertProvider`, `adminDeleteProvider`

Every mutating function requires the `token` in its input and re-validates it server-side using `supabaseAdmin` (bypasses RLS). The token is just a signed value derived from the secret — short-lived, stored in `sessionStorage` on the client.

The admin code `2026` is stored as a runtime secret `ADMIN_ACCESS_CODE` (I'll request it via the secret prompt — you can change it any time without redeploying).

### 3. Catalog loader

Replace the hardcoded `PROMOTIONS` / `SITES` / `SMS_PROVIDERS` exports with a TanStack Query hook `useCatalog()` that fetches from the `sites`, `promotions`, `sms_providers` tables (public read). The SMS generator uses this hook instead of static imports.

The static file stays as a fallback type definition only — runtime data comes from the DB.

### 4. UI components

- `src/components/AdminButton.tsx` — gear icon top-right, opens code dialog.
- `src/components/AdminCodeDialog.tsx` — 4-digit input, calls `verifyAdminCode`.
- `src/components/AdminEditor.tsx` — full-screen dialog with 3 tabs (Sites / Promotions / Providers), each rendering an editable table using existing shadcn `Table`, `Input`, `Button` components.

Mounted once inside `SmsGenerator.tsx` header area.

### 5. Wiring

- `src/routes/api/shortio.ts` already looks up by `promotion_id`; it will fetch the destination URL and short domain from the DB instead of the hardcoded list, so changes apply immediately without redeploy.

---

## Files touched

**New**
- `supabase/migrations/<timestamp>_admin_catalog.sql` — 3 tables, RLS, seed data
- `src/lib/admin.functions.ts` — server functions
- `src/lib/catalog.ts` — `useCatalog()` hook
- `src/components/AdminButton.tsx`
- `src/components/AdminCodeDialog.tsx`
- `src/components/AdminEditor.tsx`

**Edited**
- `src/components/SmsGenerator.tsx` — use `useCatalog()` + mount `<AdminButton />`
- `src/routes/api/shortio.ts` — read promotion from DB instead of static file

**Kept as-is**
- `src/lib/promotions.ts` — types only; data moves to DB

---

## Secret needed

I'll request one runtime secret: **`ADMIN_ACCESS_CODE`** (set to `2026`). Storing it as a secret means you can change the code later without me touching code.

---

## Out of scope (ask if you want these too)

- Audit log of who edited what (no auth on the app today).
- Bulk CSV import/export of promotions.
- Per-user accounts / multi-admin roles.