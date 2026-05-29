// Server-only helpers for SOCIAL variation:
// - Per-platform opener / shape / emoji seeds.
// - Recent-output memory keyed by (site_id, platform, tone).

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SocialPlatform, SocialTone } from "@/lib/social-compliance";

// ───── Pools ─────

const FB_OPENERS = [
  "Quick update —",
  "Heads up to our community:",
  "Worth a look this week:",
  "Something new on the platform:",
  "Friendly reminder —",
  "On the table right now:",
];

const IG_OPENERS = [
  "Saved you a scroll —",
  "Tap in if this is you:",
  "New on the grid:",
  "Spotted this week:",
  "For the weekend crowd:",
  "Game feature alert —",
];

const X_OPENERS = [
  "Quick one:",
  "Heads up.",
  "ICYMI:",
  "Community check —",
  "Brand update:",
  "Worth knowing:",
];

const TIKTOK_OPENERS = [
  "okay so this is fun",
  "wait, you'll like this",
  "POV: weekend mode",
  "low-key obsessed with this feature",
  "telling everyone about this",
  "the community gets it",
];

const TELEGRAM_OPENERS = [
  "Community update —",
  "Eligibility reminder:",
  "Platform note:",
  "For everyone here:",
  "Brand notice —",
  "Quick share with the channel:",
];

const PLATFORM_OPENERS: Record<SocialPlatform, string[]> = {
  facebook: FB_OPENERS,
  instagram: IG_OPENERS,
  x: X_OPENERS,
  tiktok: TIKTOK_OPENERS,
  telegram: TELEGRAM_OPENERS,
};

const SHAPES = [
  "single statement + soft CTA",
  "two short fragments separated by a period",
  "lead with a question, follow with one fact",
  "observation + soft invitation",
  "fragment + line break + short note",
];

const TONE_HINTS: Record<SocialTone, string> = {
  promotional: "high-energy, short punchy sentences, controlled — never spammy",
  friendly: "warm, conversational, second-person 'you', soft invitations",
  informational: "neutral, factual, brand-update voice, no emoji, no claims",
};

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickN<T>(arr: readonly T[], n: number): T[] {
  return shuffle(arr).slice(0, Math.min(n, arr.length));
}

export type PlatformSeed = {
  openersA: string[];
  openersB: string[];
  openersC: string[];
  shapeA: string;
  shapeB: string;
  shapeC: string;
  toneHint: string;
};

export function makePlatformSeed(platform: SocialPlatform, tone: SocialTone): PlatformSeed {
  const pool = PLATFORM_OPENERS[platform];
  return {
    openersA: pickN(pool, 3),
    openersB: pickN(pool, 3),
    openersC: pickN(pool, 3),
    shapeA: pick(SHAPES),
    shapeB: pick(SHAPES),
    shapeC: pick(SHAPES),
    toneHint: TONE_HINTS[tone],
  };
}

export function renderPlatformSeedBlock(seed: PlatformSeed): string {
  return `VARIATION SEED — each variant must use a DIFFERENT opener style:
  · variantA openers → ${seed.openersA.map((o) => `"${o}"`).join(" | ")}; shape: ${seed.shapeA}
  · variantB openers → ${seed.openersB.map((o) => `"${o}"`).join(" | ")}; shape: ${seed.shapeB}
  · variantC openers → ${seed.openersC.map((o) => `"${o}"`).join(" | ")}; shape: ${seed.shapeC}
Tone target: ${seed.toneHint}`;
}

// ───── Recent-output memory ─────

export async function fetchRecentSocial(
  siteId: string | null,
  platform: SocialPlatform,
  tone: SocialTone,
  limit = 8,
): Promise<string[]> {
  try {
    let q = supabaseAdmin
      .from("recent_social_outputs")
      .select("text")
      .eq("platform", platform)
      .eq("tone", tone)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (siteId) q = q.eq("site_id", siteId);
    else q = q.is("site_id", null);
    const { data, error } = await q;
    if (error || !data) return [];
    return data.map((r) => String(r.text)).filter(Boolean);
  } catch {
    return [];
  }
}

export async function saveRecentSocial(
  siteId: string | null,
  platform: SocialPlatform,
  tone: SocialTone,
  texts: string[],
): Promise<void> {
  const rows = texts
    .filter((t) => typeof t === "string" && t.trim().length > 0)
    .map((t) => ({
      site_id: siteId,
      platform,
      tone,
      text: t.trim(),
    }));
  if (rows.length === 0) return;
  try {
    await supabaseAdmin.from("recent_social_outputs").insert(rows);
  } catch {
    /* best-effort */
  }
}

export function renderRecentSocialBlock(texts: string[]): string {
  if (texts.length === 0) return "";
  const lines = texts
    .slice(0, 5)
    .map((t, i) => {
      const trimmed = t.length > 100 ? `${t.slice(0, 100)}…` : t;
      return `  ${i + 1}. ${trimmed}`;
    })
    .join("\n");
  return `RECENT POSTS — do NOT mirror their openers, shapes, or phrasing:
${lines}`;
}
