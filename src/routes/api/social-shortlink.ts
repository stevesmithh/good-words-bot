import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type ReadyBody = {
  action: "ready";
  promotionId: string;
};

type ManualBody = {
  action: "manual";
  siteId: string;
  destinationUrl: string;
  label?: string;
};

type Body = ReadyBody | ManualBody;

const CHANNEL = "social";
const SHORTIO_TAG = "sm";

function randomSlug() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function buildUtmUrl(destinationUrl: string, campaignSlug: string): string {
  const url = new URL(destinationUrl);
  url.searchParams.set("utm_source", "social");
  url.searchParams.set("utm_medium", "social");
  url.searchParams.set("utm_campaign", campaignSlug);
  return url.toString();
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase admin credentials not configured");
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function createShortioLink(opts: {
  apiKey: string;
  domain: string;
  destinationUrl: string;
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
      tags: [SHORTIO_TAG],
    }),
  });

  const text = await resp.text();
  if (!resp.ok) throw new Error(`short.io ${resp.status}: ${text.slice(0, 300)}`);
  let json: { shortURL?: string; secureShortURL?: string; idString?: string; id?: string };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`short.io returned non-JSON: ${text.slice(0, 200)}`);
  }
  const shortUrl = json.secureShortURL || json.shortURL;
  const shortioId = json.idString || json.id || "";
  if (!shortUrl) throw new Error("short.io response missing shortURL");
  return { shortUrl, shortioId: String(shortioId) };
}

export const Route = createFileRoute("/api/social-shortlink")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Body;
          const apiKey = process.env.SHORTIO_API_KEY;
          if (!apiKey) {
            return Response.json({ error: "SHORTIO_API_KEY is not configured" }, { status: 500 });
          }
          const supabase = getSupabaseAdmin();

          if (body.action === "ready") {
            if (!body.promotionId) {
              return Response.json({ error: "promotionId is required" }, { status: 400 });
            }
            const { data: promo, error: promoErr } = await supabase
              .from("promotions")
              .select("id, destination_url, short_domain_override, sites(short_domain)")
              .eq("id", body.promotionId)
              .maybeSingle();
            if (promoErr) {
              console.error("[social-shortlink] promotion lookup error:", promoErr);
              return Response.json({ error: "Database operation failed" }, { status: 500 });
            }
            if (!promo) return Response.json({ error: "Unknown promotion" }, { status: 400 });

            const siteRel = promo.sites as unknown as
              | { short_domain: string }
              | { short_domain: string }[]
              | null;
            const siteShortDomain = Array.isArray(siteRel)
              ? siteRel[0]?.short_domain
              : siteRel?.short_domain;
            const shortDomain =
              (promo.short_domain_override as string | null) || siteShortDomain;
            if (!shortDomain) {
              return Response.json({ error: "Site has no short domain configured" }, { status: 500 });
            }
            const destinationUrl = promo.destination_url as string;
            const promoId = promo.id as string;

            // Reuse an unused social link for this promotion + domain if any
            const { data: existing, error: lookupErr } = await supabase
              .from("sms_short_links")
              .select("id, short_url, destination_url")
              .eq("promotion_id", promoId)
              .eq("channel", CHANNEL)
              .eq("short_domain", shortDomain)
              .is("used_at", null)
              .order("created_at", { ascending: true })
              .limit(1);
            if (lookupErr) {
              console.error("[social-shortlink] lookup error:", lookupErr);
              return Response.json({ error: "Database operation failed" }, { status: 500 });
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

            const slug = randomSlug();
            const utmUrl = buildUtmUrl(destinationUrl, slug);
            let created;
            try {
              created = await createShortioLink({ apiKey, domain: shortDomain, destinationUrl: utmUrl });
            } catch (err) {
              console.error("[social-shortlink] short.io error:", err);
              return Response.json({ error: "Failed to create short link" }, { status: 502 });
            }

            const { data: inserted, error: insertErr } = await supabase
              .from("sms_short_links")
              .insert({
                promotion_id: promoId,
                provider: "social",
                channel: CHANNEL