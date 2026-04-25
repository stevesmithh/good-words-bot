import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase admin credentials not configured");
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

type Body = {
  action: string;
  code: string;
  [key: string]: unknown;
};

function bad(msg: string, status = 400) {
  return Response.json({ error: msg }, { status });
}

function asStr(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

// Simple in-memory rate limiter (per IP). Best-effort — process-local.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const FAIL_LIMIT_WINDOW_MS = 5 * 60_000;
const FAIL_LIMIT_MAX = 10;
const hits = new Map<string, number[]>();
const fails = new Map<string, number[]>();

function clientIp(request: Request): string {
  const h = request.headers;
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    (h.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown"
  );
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE_LIMIT_MAX;
}

function tooManyFails(ip: string): boolean {
  const now = Date.now();
  const arr = (fails.get(ip) ?? []).filter((t) => now - t < FAIL_LIMIT_WINDOW_MS);
  fails.set(ip, arr);
  return arr.length >= FAIL_LIMIT_MAX;
}

function recordFail(ip: string) {
  const now = Date.now();
  const arr = (fails.get(ip) ?? []).filter((t) => now - t < FAIL_LIMIT_WINDOW_MS);
  arr.push(now);
  fails.set(ip, arr);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still compare to avoid early-exit timing leak on length
    let diff = 1;
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    }
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export const Route = createFileRoute("/api/admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const ip = clientIp(request);
          if (rateLimited(ip)) return bad("Too many requests", 429);
          if (tooManyFails(ip)) return bad("Too many failed attempts. Try again later.", 429);

          const body = (await request.json()) as Body;

          const expected = process.env.ADMIN_ACCESS_CODE;
          if (!expected) return bad("Admin access not configured", 500);

          const provided = typeof body.code === "string" ? body.code : "";
          if (!timingSafeEqual(provided, expected)) {
            recordFail(ip);
            return bad("Invalid admin code", 401);
          }

          const supabase = getSupabaseAdmin();

          switch (body.action) {
            case "verify": {
              return Response.json({ success: true });
            }

            case "upsertSite": {
              const id = asStr(body.id);
              const name = asStr(body.name);
              const short_domain = asStr(body.short_domain);
              if (!id || !name || !short_domain) return bad("id, name, short_domain required");
              if (!/^[a-zA-Z0-9_-]+$/.test(id)) return bad("Invalid id format");
              if (id.length > 64 || name.length > 200 || short_domain.length > 253)
                return bad("Field too long");
              const { error } = await supabase
                .from("sites")
                .upsert({ id, name, short_domain }, { onConflict: "id" });
              if (error) {
                console.error("[admin] upsertSite error:", error);
                return bad("Database operation failed", 500);
              }
              return Response.json({ success: true });
            }

            case "deleteSite": {
              const id = asStr(body.id);
              if (!id) return bad("id required");
              const { error } = await supabase.from("sites").delete().eq("id", id);
              if (error) {
                console.error("[admin] deleteSite error:", error);
                return bad("Database operation failed", 500);
              }
              return Response.json({ success: true });
            }

            case "upsertPromotion": {
              const id = asStr(body.id);
              const site_id = asStr(body.site_id);
              const name = asStr(body.name);
              const destination_url = asStr(body.destination_url);
              const short_domain_override =
                body.short_domain_override === null ? null : asStr(body.short_domain_override);
              if (!id || !site_id || !name || !destination_url) {
                return bad("id, site_id, name, destination_url required");
              }
              if (!/^[a-zA-Z0-9_-]+$/.test(id)) return bad("Invalid id format");
              if (
                id.length > 64 ||
                site_id.length > 64 ||
                name.length > 200 ||
                destination_url.length > 2000 ||
                (short_domain_override && short_domain_override.length > 253)
              )
                return bad("Field too long");
              const { error } = await supabase
                .from("promotions")
                .upsert(
                  { id, site_id, name, destination_url, short_domain_override },
                  { onConflict: "id" },
                );
              if (error) {
                console.error("[admin] upsertPromotion error:", error);
                return bad("Database operation failed", 500);
              }
              return Response.json({ success: true });
            }

            case "deletePromotion": {
              const id = asStr(body.id);
              if (!id) return bad("id required");
              const { error } = await supabase.from("promotions").delete().eq("id", id);
              if (error) {
                console.error("[admin] deletePromotion error:", error);
                return bad("Database operation failed", 500);
              }
              return Response.json({ success: true });
            }

            case "upsertProvider": {
              const id = asStr(body.id);
              const name = asStr(body.name);
              if (!name) return bad("name required");
              if (name.length > 200) return bad("Field too long");
              if (id) {
                const { error } = await supabase
                  .from("sms_providers")
                  .update({ name })
                  .eq("id", id);
                if (error) {
                  console.error("[admin] upsertProvider update error:", error);
                  return bad("Database operation failed", 500);
                }
              } else {
                const { error } = await supabase.from("sms_providers").insert({ name });
                if (error) {
                  console.error("[admin] upsertProvider insert error:", error);
                  return bad("Database operation failed", 500);
                }
              }
              return Response.json({ success: true });
            }

            case "deleteProvider": {
              const id = asStr(body.id);
              if (!id) return bad("id required");
              const { error } = await supabase.from("sms_providers").delete().eq("id", id);
              if (error) {
                console.error("[admin] deleteProvider error:", error);
                return bad("Database operation failed", 500);
              }
              return Response.json({ success: true });
            }

            default:
              return bad("Unknown action");
          }
        } catch (err) {
          console.error("[admin] handler error:", err);
          return Response.json({ error: "Server error" }, { status: 500 });
        }
      },
    },
  },
});
