# Login + Credits Usage Tracking

Add a simple shared-password login gate to the app and track every generation per user. Add an admin dashboard (steve) to review usage and manage team credentials.

## How it will work

- A login screen blocks access to the entire app. Each team member signs in with their personal username + password.
- After login, the app works exactly as today, but every Email/SMS generation is recorded against that user (username + timestamp + type).
- Steve gets an extra "Team usage" tab in the existing Admin Editor where he can:
  - See total generations per user with date filters: Today, Yesterday, Last 7 days, Custom range.
  - See a list of all team members with their current login + password.
  - Add / edit / delete team members (change username, change password, mark as admin).
- Logout button shown in the header next to the current user's name.

## Initial team members (seeded)

| Username | Password         | Role  |
|----------|------------------|-------|
| alice    | alice0125@       | user  |
| natalie  | natalie8771@     | user  |
| romeo    | romeo98771@      | user  |
| leo      | leo18882@        | user  |
| steve    | steve01001@      | admin |
| chris    | chris6001@       | user  |

Steve can change any of these from the admin panel later.

## Technical details

### Database (new tables)

- `team_members` — `id uuid pk`, `username text unique`, `password text`, `is_admin bool`, `created_at`, `updated_at`. RLS: no public access (only reached via server functions).
- `generation_events` — `id uuid pk`, `username text`, `kind text ('email'|'sms')`, `created_at timestamptz default now()`. RLS: no public access.
- Seed the 6 users via a one-time `INSERT` in the migration.

Passwords are stored in plaintext because the user wants to view/edit them in the admin panel. This is an internal team tool, not a public auth system — we'll note the tradeoff but follow the requested design.

### Auth gate (client + server)

- Reuse the existing `/api/admin` pattern. New server route `/api/auth` with actions:
  - `login` → verify username+password against `team_members`, return `{ username, isAdmin }` on success.
  - `listMembers` / `upsertMember` / `deleteMember` → admin-only (verified via `adminCode` OR via posting the admin's own username+password again on each call).
  - `usage` → admin-only, returns counts grouped by username, filtered by date range.
- Session: store `{ username, isAdmin }` in `localStorage` after successful login. A new `<AuthGate>` wrapper in `src/routes/__root.tsx` (or in `src/routes/index.tsx`) renders a login form when no session is present.
- Logout: clears localStorage and reloads.

### Logging generations

- Add a tiny helper `logGeneration(username, kind)` called from `src/routes/api/generate-email.ts` and `src/routes/api/generate-sms.ts` right after a successful generation. Username is passed in the request body from the client (read from localStorage).
- Server inserts a row into `generation_events` using the admin Supabase client.

### Admin dashboard

- Extend `src/components/AdminEditor.tsx` with a new "Team & Usage" tab visible only when `isAdmin === true`.
- Two sub-sections:
  1. **Usage**: date filter (Today / Yesterday / 7d / Custom) → table of `username | email count | sms count | total`.
  2. **Members**: editable table of `username | password | admin?` with add/delete/save buttons.

### Files to add / change

- `supabase` migration: create the two tables, RLS policies, seed rows.
- `src/routes/api/auth.ts` — new server route.
- `src/lib/session.ts` — small client helper for getting/setting current user in localStorage.
- `src/components/AuthGate.tsx` — login screen + wrapper.
- `src/routes/__root.tsx` — wrap children in `<AuthGate>`.
- `src/routes/index.tsx` — show username + logout button in header.
- `src/components/AdminEditor.tsx` — add Team & Usage tab.
- `src/routes/api/generate-email.ts` / `generate-sms.ts` — accept `username` in body, log generation.
- `src/components/EmailGenerator.tsx` / `SmsGenerator.tsx` — send `username` from session in the request body.

## Notes / tradeoffs

- Plaintext passwords are intentional per the request. If you ever want to harden this, we can switch to hashed passwords and remove the "view password" feature.
- This is shared-secret login — no real Supabase Auth users. Simple and matches the goal of just attributing usage to a person.
