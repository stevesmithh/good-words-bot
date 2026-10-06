import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { verifyMemberCreds, unauthorized } from "@/server/member-auth.server";

// Returns sites + promotions to signed-in team members only.
export const Route = createFileRoute("/api/catalog")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        if (!(await verifyMemberCreds(body))) return unauthorized();
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) return Response.json({ error: "Not configured" }, { status: 500 });
        const db = createClient(url, key, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const [sites, promos] = await Promise.all([
          db.from("sites").select("id, name, short_domain, sort_order").order("sort_order"),
          db
            .from("promotions")
            .select("id, site_id, name, destination_url, short_domain_override, sort_order")
            .order("sort_order"),
        ]);
        if (sites.error || promos.error) {
          console.error("[catalog]", sites.error || promos.error);
          return Response.json({ error: "Could not load catalog" }, { status: 500 });
        }
        return Response.json({ sites: sites.data ?? [], promotions: promos.data ?? [] });
      },
    },
  },
});
