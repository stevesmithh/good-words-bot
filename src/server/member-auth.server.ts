// Server-only: verifies a request carries valid team-member credentials.
// Reused by all paid / privileged API endpoints (AI generation, short links).
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;

function isBcryptHash(v: string): boolean {
  return typeof v === "string" && /^\$2[aby]\$/.test(v);
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase admin credentials not configured");
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type Creds = { username?: unknown; password?: unknown };

/**
 * Verifies username/password from a request body against team_members.
 * Returns the member row on success, or null when unauthorized.
 * Legacy plaintext passwords are auto-upgraded to bcrypt on match.
 */
export async function verifyMemberCreds(raw: unknown) {
  const body = (raw ?? {}) as Creds;
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password || username.length > 100 || password.length > 200) return null;

  const supabase = getSupabaseAdmin();
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
    ok = stored === password;
    if (ok) {
      try {
        const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
        await supabase.from("team_members").update({ password: hashed }).eq("id", data.id);
      } catch (e) {
        console.error("[member-auth] password auto-upgrade failed:", e);
      }
    }
  }
  if (!ok) return null;
  return data;
}

/** 401 response helper for endpoints. */
export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
