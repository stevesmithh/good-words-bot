import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { getPromotionById } from "@/lib/promotions";

type GetOrCreateBody = {
  action: "get-or-create";
  promotionId: string;
  provider: string;
};

type MarkUsedBody = {
  action: "mark-used";
  linkId: string;
};

type Body = GetOrCreateBody | MarkUsedBody;

const VALID_PROVIDERS = new Set(["SMSEdge", "Dexatel", "Laaffic"]);

// Random alphanumeric slug, e.g. "o96f88"
function randomSlug() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function buildUtmUrl(destinationUrl: string, provider: string, campaignSlug: string): string {
  const url = new URL(destinationUrl);
  url.searchParams.set("utm_source", provider.toLowerCase());
  url.searchParams.set("utm_medium", "sms");
  url.searchParams.set("utm_campaign", campaignSlug);
  return url.toString();
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase admin credentials not configured");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function createShortioLink(opts: {
  apiKey: string;
  domain: string;
  destinationUrl: string;
  slug: string;
}): Promise<{ shortUrl: string; shortioId: string }> {
  const resp = await fetch("https://api.short.io/links", {
    method: "POST",
    headers: {
      Authorization: opts.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      originalURL: opts.destinationUrl,
      domain: opts.domain,
      allowDuplicates: true,
      tags: ["sms"],
    }),
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`short.io ${resp.status}: ${text.slice(0, 300)}`);
  }
  let json: { shortURL?: string; secureShortURL?: string; idString?: string; id?: string };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`short.io returned non-JSON: ${text.slice(0, 200)}`);
  }
  const shortUrl = json.secureShortURL || json.shortURL;
  const shortioId = json.idString || json.id || "";
  if (!shortUrl) {
    throw new Error("short.io response missing shortURL");
  }
  return { shortUrl, shortioId: String(shortioId) };
}

export const Route = createFileRoute("/api/shortio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Body;

          if (body.action === "mark-used") {
            if (!body.linkId || typeof body.linkId !== "string") {
              return Response.json({ error: "linkId is required" }, { status: 400 });
            }
            const supabase = getSupabaseAdmin();
            const { error } = await supabase
              .from("sms_short_links")
              .update({ used_at: new Date().toISOString() })
              .eq("id", body.linkId);
            if (error) {
              return Response.json({ error: error.message }, { status: 500 });
            }
            return Response.json({ success: true });
          }

          if (body.action === "get-or-create") {
            if (!body.promotionId || !body.provider) {
              return Response.json(
                { error: "promotionId and provider are required" },
                { status: 400 },
              );
            }
            if (!VALID_PROVIDERS.has(body.provider)) {
              return Response.json({ error: "Invalid provider" }, { status: 400 });
            }
            const promo = getPromotionById(body.promotionId);
            if (!promo) {
              return Response.json({ error: "Unknown promotion" }, { status: 400 });
            }

            const supabase = getSupabaseAdmin();

            // 1. Look for an unused link for this promotion + provider
            const { data: existing, error: lookupErr } = await supabase
              .from("sms_short_links")
              .select("id, short_url, destination_url")
              .eq("promotion_id", promo.id)
              .eq("provider", body.provider)
              .is("used_at", null)
              .order("created_at", { ascending: true })
              .limit(1);

            if (lookupErr) {
              return Response.json({ error: lookupErr.message }, { status: 500 });
            }

            if (existing && existing.length > 0) {
              const row = existing[0];
              return Response.json({
                linkId: row.id as string,
                shortUrl: row.short_url as string,
                destinationUrl: row.destination_url as string,
                isReused: true,
              });
            }

            // 2. None unused — create a new one via short.io
            const apiKey = process.env.SHORTIO_API_KEY;
            if (!apiKey) {
              return Response.json(
                { error: "SHORTIO_API_KEY is not configured" },
                { status: 500 },
              );
            }

            const slug = randomSlug();
            const utmUrl = buildUtmUrl(promo.destinationUrl, body.provider, slug);

            let created;
            try {
              created = await createShortioLink({
                apiKey,
                domain: promo.shortDomain,
                destinationUrl: utmUrl,
                slug,
              });
            } catch (err) {
              const msg = err instanceof Error ? err.message : "short.io error";
              return Response.json({ error: msg }, { status: 502 });
            }

            // 3. Save to DB
            const { data: inserted, error: insertErr } = await supabase
              .from("sms_short_links")
              .insert({
                promotion_id: promo.id,
                provider: body.provider,
                destination_url: utmUrl,
                short_url: created.shortUrl,
                shortio_id: created.shortioId,
                short_domain: promo.shortDomain,
              })
              .select("id")
              .single();

            if (insertErr || !inserted) {
              return Response.json(
                { error: insertErr?.message || "Failed to save link" },
                { status: 500 },
              );
            }

            return Response.json({
              linkId: inserted.id as string,
              shortUrl: created.shortUrl,
              destinationUrl: utmUrl,
              isReused: false,
            });
          }

          return Response.json({ error: "Unknown action" }, { status: 400 });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
