import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const ADMIN_CODE = "2026";

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

export const Route = createFileRoute("/api/admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Body;
          if (body.code !== ADMIN_CODE) return bad("Invalid admin code", 401);

          const supabase = getSupabaseAdmin();

          switch (body.action) {
            case "upsertSite": {
              const id = asStr(body.id);
              const name = asStr(body.name);
              const short_domain = asStr(body.short_domain);
              if (!id || !name || !short_domain) return bad("id, name, short_domain required");
              if (!/^[a-zA-Z0-9_-]+$/.test(id)) return bad("Invalid id format");
              const { error } = await supabase
                .from("sites")
                .upsert({ id, name, short_domain }, { onConflict: "id" });
              if (error) return bad(error.message, 500);
              return Response.json({ success: true });
            }

            case "deleteSite": {
              const id = asStr(body.id);
              if (!id) return bad("id required");
              const { error } = await supabase.from("sites").delete().eq("id", id);
              if (error) return bad(error.message, 500);
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
              const { error } = await supabase
                .from("promotions")
                .upsert(
                  { id, site_id, name, destination_url, short_domain_override },
                  { onConflict: "id" },
                );
              if (error) return bad(error.message, 500);
              return Response.json({ success: true });
            }

            case "deletePromotion": {
              const id = asStr(body.id);
              if (!id) return bad("id required");
              const { error } = await supabase.from("promotions").delete().eq("id", id);
              if (error) return bad(error.message, 500);
              return Response.json({ success: true });
            }

            case "upsertProvider": {
              const id = asStr(body.id);
              const name = asStr(body.name);
              if (!name) return bad("name required");
              if (id) {
                const { error } = await supabase
                  .from("sms_providers")
                  .update({ name })
                  .eq("id", id);
                if (error) return bad(error.message, 500);
              } else {
                const { error } = await supabase.from("sms_providers").insert({ name });
                if (error) return bad(error.message, 500);
              }
              return Response.json({ success: true });
            }

            case "deleteProvider": {
              const id = asStr(body.id);
              if (!id) return bad("id required");
              const { error } = await supabase.from("sms_providers").delete().eq("id", id);
              if (error) return bad(error.message, 500);
              return Response.json({ success: true });
            }

            default:
              return bad("Unknown action");
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
