import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;

function isBcryptHash(v: string): boolean {
  return typeof v === "string" && /^\$2[aby]\$/.test(v);
}

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase admin credentials not configured");
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

function bad(msg: string, status = 400) {
  return Response.json({ error: msg }, { status });
}

function asStr(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

// Verify the requester is a valid team member; returns the row or null.
// Supports both bcrypt hashes and legacy plaintext (auto-upgrades on match).
async function verifyMember(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  username: string,
  password: string,
) {
  const { data, error } = await supabase
    .from("team_members")
    .select("id, username, password, is_admin")
    .eq("username", username)
    .maybeSingle();
  if (error || !data) return null;

  const stored = data.password as string;
  let ok = false;
  if (isBcryptHash(stored)) {
    try {
      ok = await bcrypt.compare(password, stored);
    } catch {
      ok = false;
    }
  } else {
    // Legacy plaintext fallback — verify, then upgrade to bcrypt in place.
    ok = stored === password;
    if (ok) {
      try {
        const hashed = await hashPassword(password);
        await supabase.from("team_members").update({ password: hashed }).eq("id", data.id);
      } catch (e) {
        console.error("[auth] password auto-upgrade failed:", e);
      }
    }
  }
  if (!ok) return null;
  return data;
}

type Body = {
  action: string;
  username?: string;
  password?: string;
  [k: string]: unknown;
};

function startOf(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function rangeFor(filter: string, customFrom?: string, customTo?: string): { from: Date; to: Date } {
  const now = new Date();
  if (filter === "today") {
    return { from: startOf(now), to: now };
  }
  if (filter === "yesterday") {
    const start = startOf(now);
    const yStart = new Date(start);
    yStart.setDate(yStart.getDate() - 1);
    return { from: yStart, to: start };
  }
  if (filter === "7d") {
    const start = startOf(now);
    start.setDate(start.getDate() - 6);
    return { from: start, to: now };
  }
  if (filter === "custom" && customFrom && customTo) {
    const from = new Date(customFrom);
    const to = new Date(customTo);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  // default last 7d
  const start = startOf(now);
  start.setDate(start.getDate() - 6);
  return { from: start, to: now };
}

export const Route = createFileRoute("/api/auth")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Body;
          const supabase = getSupabaseAdmin();

          // --- Public action: login ---
          if (body.action === "login") {
            const username = asStr(body.username);
            const password = asStr(body.password);
            if (!username || !password) return bad("Username and password required");
            if (username.length > 100 || password.length > 200) return bad("Field too long");
            const member = await verifyMember(supabase, username, password);
            if (!member) return bad("Invalid username or password", 401);
            return Response.json({
              success: true,
              username: member.username,
              isAdmin: member.is_admin,
            });
          }

          // --- Authenticated actions: require valid session credentials ---
          const sessUser = asStr(body.username);
          const sessPass = asStr(body.password);
          if (!sessUser || !sessPass) return bad("Unauthorized", 401);
          const me = await verifyMember(supabase, sessUser, sessPass);
          if (!me) return bad("Unauthorized", 401);

          // logGeneration is allowed for any logged-in member
          if (body.action === "logGeneration") {
            const kind = asStr(body.kind);
            if (kind !== "email" && kind !== "sms") return bad("Invalid kind");
            const { error } = await supabase
              .from("generation_events")
              .insert({ username: me.username, kind });
            if (error) {
              console.error("[auth] logGeneration error:", error);
              return bad("Database operation failed", 500);
            }
            return Response.json({ success: true });
          }

          // Any logged-in member can fetch the SMS providers catalog
          if (body.action === "listProviders") {
            const { data, error } = await supabase
              .from("sms_providers")
              .select("id, name, sort_order")
              .order("sort_order");
            if (error) {
              console.error("[auth] listProviders error:", error);
              return bad("Database operation failed", 500);
            }
            return Response.json({ providers: data ?? [] });
          }


          // Admin-only actions
          if (!me.is_admin) return bad("Admin only", 403);

          switch (body.action) {
            case "listMembers": {
              const { data, error } = await supabase
                .from("team_members")
                .select("id, username, password, is_admin, created_at")
                .order("created_at", { ascending: true });
              if (error) {
                console.error("[auth] listMembers error:", error);
                return bad("Database operation failed", 500);
              }
              return Response.json({ members: data });
            }

            case "upsertMember": {
              const id = asStr(body.id);
              const username = asStr(body.newUsername);
              const password = asStr(body.newPassword);
              const isAdmin = !!body.isAdmin;
              if (!username || !password) return bad("Username and password required");
              if (username.length > 100 || password.length > 200) return bad("Field too long");
              if (id) {
                const { error } = await supabase
                  .from("team_members")
                  .update({ username, password, is_admin: isAdmin })
                  .eq("id", id);
                if (error) {
                  console.error("[auth] update member error:", error);
                  return bad(error.message.includes("duplicate") ? "Username already taken" : "Database operation failed", 500);
                }
              } else {
                const { error } = await supabase
                  .from("team_members")
                  .insert({ username, password, is_admin: isAdmin });
                if (error) {
                  console.error("[auth] insert member error:", error);
                  return bad(error.message.includes("duplicate") ? "Username already taken" : "Database operation failed", 500);
                }
              }
              return Response.json({ success: true });
            }

            case "deleteMember": {
              const id = asStr(body.id);
              if (!id) return bad("id required");
              if (id === me.id) return bad("You cannot delete your own account");
              const { error } = await supabase.from("team_members").delete().eq("id", id);
              if (error) {
                console.error("[auth] deleteMember error:", error);
                return bad("Database operation failed", 500);
              }
              return Response.json({ success: true });
            }

            case "usage": {
              const filter = asStr(body.filter) ?? "7d";
              const customFrom = asStr(body.from) ?? undefined;
              const customTo = asStr(body.to) ?? undefined;
              const { from, to } = rangeFor(filter, customFrom, customTo);
              const { data, error } = await supabase
                .from("generation_events")
                .select("username, kind, created_at")
                .gte("created_at", from.toISOString())
                .lte("created_at", to.toISOString())
                .order("created_at", { ascending: false })
                .limit(10000);
              if (error) {
                console.error("[auth] usage error:", error);
                return bad("Database operation failed", 500);
              }
              const byUser = new Map<string, { email: number; sms: number }>();
              for (const row of data ?? []) {
                const u = row.username as string;
                const k = row.kind as string;
                const e = byUser.get(u) ?? { email: 0, sms: 0 };
                if (k === "email") e.email++;
                else if (k === "sms") e.sms++;
                byUser.set(u, e);
              }
              const summary = Array.from(byUser.entries())
                .map(([username, c]) => ({
                  username,
                  email: c.email,
                  sms: c.sms,
                  total: c.email + c.sms,
                }))
                .sort((a, b) => b.total - a.total);
              const totals = summary.reduce(
                (acc, r) => {
                  acc.email += r.email;
                  acc.sms += r.sms;
                  acc.total += r.total;
                  return acc;
                },
                { email: 0, sms: 0, total: 0 },
              );
              return Response.json({
                from: from.toISOString(),
                to: to.toISOString(),
                summary,
                totals,
                recent: (data ?? []).slice(0, 100),
              });
            }

            default:
              return bad("Unknown action");
          }
        } catch (err) {
          console.error("[auth] handler error:", err);
          return Response.json({ error: "Server error" }, { status: 500 });
        }
      },
    },
  },
});
