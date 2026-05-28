import { createFileRoute } from "@tanstack/react-router";
import { callClaudeWithTool } from "@/server/anthropic.server";
import {
  PLATFORM_POLICIES,
  SOCIAL_PLATFORMS,
  autoRewriteHighRisk,
  detectDisclaimerInText,
  detectGeoInText,
  scoreVariant,
  type RiskLevel,
  type SocialPlatform,
  type SocialTone,
  type ScoreResult,
} from "@/lib/social-compliance";
import {
  fetchRecentSocial,
  makePlatformSeed,
  renderPlatformSeedBlock,
  renderRecentSocialBlock,
  saveRecentSocial,
} from "@/server/social-variation.server";

type SocialBody = {
  siteId?: string;
  brandName?: string;
  promotionName?: string;
  promotionUrl?: string;
  topic?: string;
  geo?: string;
  isUsIgaming?: boolean;
  tone: SocialTone;
  platforms: SocialPlatform[];
};

type VariantOut = {
  copy: string;
  hashtags: string[];
  risk: RiskLevel;
  reasons: string[];
  rewritten: boolean;
};

type PlatformOut = {
  platform: SocialPlatform;
  variants: VariantOut[];
  error?: string;
};

const ALL_PLATFORM_IDS = SOCIAL_PLATFORMS.map((p) => p.id);

function isPlatform(v: unknown): v is SocialPlatform {
  return typeof v === "string" && (ALL_PLATFORM_IDS as string[]).includes(v);
}

function tooLong(s: string | undefined, max: number): boolean {
  return typeof s === "string" && s.length > max;
}

function buildPlatformPrompt(
  body: SocialBody,
  platform: SocialPlatform,
  seedBlock: string,
  recentBlock: string,
): string {
  const policy = PLATFORM_POLICIES[platform];
  const brand = body.brandName?.trim() || body.siteId?.trim() || "the brand";
  const promo = body.promotionName?.trim() || "the current promotion";
  const topic = body.topic?.trim() || "(none — write a general brand-safe update tied to the promotion)";
  const geo = body.geo?.trim() || "(not specified)";
  const linkLine =
    policy.allowLink && body.promotionUrl
      ? `Link to include at the end (verbatim, do NOT modify): ${body.promotionUrl}`
      : platform === "instagram"
        ? `Do NOT paste a URL. Reference "link in bio" instead.`
        : `Do NOT include any URL.`;

  return `You are a senior iGaming social-media copywriter writing for ${policy.label}. Your output MUST pass strict gambling-compliance review (Meta/TikTok/X/Telegram). Engaging and human, but never spammy and never high-risk.

BRAND: ${brand}
PROMOTION: ${promo}
TOPIC / ANGLE: ${topic}
TARGET GEO: ${geo}
TONE: ${body.tone}

PLATFORM POLICY (${policy.label}):
- Max length: ${policy.maxLength} characters total.
- ${policy.styleNote}
- Hashtags: ${policy.allowHashtags ? "use 2–5 tasteful, on-brand hashtags" : "do NOT use hashtags"}.
- Emoji policy: ${policy.emojiPolicy}.
- ${linkLine}
- Append this exact disclaimer at the end (before any link): "${policy.disclaimer}"
${body.geo?.trim() ? `- The post MUST reference the GEO (e.g. "Available in ${body.geo}.").` : ""}

ABSOLUTE BANS — these phrases are NEVER allowed in any variant (instant compliance fail):
play now, deposit now, claim now, win now, win big, free money, guaranteed win, cash out, bonus code, jackpot tonight, instant payout, risk-free, bet now, make money, one spin can change everything, click here, click link, tap here, you won, you've won, you just won, guaranteed.
${policy.forbiddenExtra.length > 0 ? `Also forbidden specifically on ${policy.label}: ${policy.forbiddenExtra.join(", ")}.` : ""}

SOFT-USE WORDS — these are medium-risk; use AT MOST ONCE across the three variants combined, and only if a disclaimer is present in the same variant:
bonus, deposit bonus, reload, jackpot, lucky, cash, payout, spin, vip win, free credits, reward, claim.

SAFER ALTERNATIVES — prefer these phrasings:
- "play now" → "explore details"
- "deposit now" → "check offer terms"
- "win big" → "explore what's available"
- "free money" → "welcome offer, T&Cs apply"
- "cash out" → "manage your session responsibly"
- "bonus code" → "offer details"
- "jackpot tonight" → "game feature spotlight"

VOICE:
- Engaging, fun, attention-grabbing — but ZERO spam vibes.
- Sound like a real social manager, not a marketing bot.
- Curiosity hook > hard sell. Tease the value.
- No ALL CAPS shouting. No "!!!".
${policy.emojiPolicy === "rich" ? "- Emoji are welcome (1–3 per post) where they fit naturally." : ""}
${policy.emojiPolicy === "light" ? "- One emoji max per post if it fits naturally." : ""}
${policy.emojiPolicy === "minimal" ? "- Avoid emoji unless absolutely natural; one max." : ""}
${policy.emojiPolicy === "none" ? "- No emoji." : ""}

${seedBlock}

${recentBlock}

OUTPUT — return THREE variants using the provided tool. Each variant has:
- "copy": the full post text including the disclaimer${policy.allowLink && body.promotionUrl ? " and the link at the very end" : ""}.
- "hashtags": ${policy.allowHashtags ? "array of 2–5 hashtag strings (with the # symbol)" : "an empty array []"}.

The three variants must use DIFFERENT openers, DIFFERENT sentence shapes, and DIFFERENT angles. Do NOT lightly paraphrase one into another.

Return your answer using the provided tool.`;
}

const SOCIAL_TOOL = {
  type: "function" as const,
  function: {
    name: "return_social_posts",
    description: "Return three platform-specific social media post variants.",
    parameters: {
      type: "object",
      properties: {
        variantA: {
          type: "object",
          properties: {
            copy: { type: "string", description: "Full post copy, including disclaimer and link if applicable." },
            hashtags: { type: "array", items: { type: "string" }, description: "Hashtags or empty array." },
          },
          required: ["copy", "hashtags"],
        },
        variantB: {
          type: "object",
          properties: {
            copy: { type: "string" },
            hashtags: { type: "array", items: { type: "string" } },
          },
          required: ["copy", "hashtags"],
        },
        variantC: {
          type: "object",
          properties: {
            copy: { type: "string" },
            hashtags: { type: "array", items: { type: "string" } },
          },
          required: ["copy", "hashtags"],
        },
      },
      required: ["variantA", "variantB", "variantC"],
      additionalProperties: false,
    },
  },
};

type RawVariant = { copy: string; hashtags: string[] };

function extractRawVariant(raw: unknown): RawVariant {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    return {
      copy: typeof r.copy === "string" ? r.copy : "",
      hashtags: Array.isArray(r.hashtags) ? r.hashtags.filter((h): h is string => typeof h === "string") : [],
    };
  }
  return { copy: "", hashtags: [] };
}

function buildScoreContext(body: SocialBody) {
  return {
    hasGeo: !!body.geo?.trim(),
    isUsIgaming: !!body.isUsIgaming,
  };
}

function finalizeVariant(
  raw: RawVariant,
  platform: SocialPlatform,
  body: SocialBody,
): VariantOut {
  let copy = raw.copy;
  let rewritten = false;
  // Mechanical rewrite of any high-risk phrase that slipped through.
  const rewritten1 = autoRewriteHighRisk(copy);
  if (rewritten1 !== copy) {
    copy = rewritten1;
    rewritten = true;
  }
  const ctx = buildScoreContext(body);
  const score: ScoreResult = scoreVariant({
    text: copy,
    platform,
    hasDisclaimer: detectDisclaimerInText(copy, platform),
    hasGeo: ctx.hasGeo && detectGeoInText(copy, body.geo!.trim()),
    isUsIgaming: ctx.isUsIgaming,
  });
  return {
    copy,
    hashtags: raw.hashtags.slice(0, 6),
    risk: score.risk,
    reasons: score.reasons,
    rewritten,
  };
}

async function generateForPlatform(
  body: SocialBody,
  platform: SocialPlatform,
): Promise<PlatformOut> {
  const siteId = body.siteId?.trim() || null;
  const seed = makePlatformSeed(platform, body.tone);
  const recent = await fetchRecentSocial(siteId, platform, body.tone, 8);
  const prompt = buildPlatformPrompt(
    body,
    platform,
    renderPlatformSeedBlock(seed),
    renderRecentSocialBlock(recent),
  );

  const ai = await callClaudeWithTool(prompt, SOCIAL_TOOL, { temperature: 0.85, top_p: 0.9 });
  if (!ai.ok) {
    return { platform, variants: [], error: ai.error };
  }

  const args = ai.args as Record<string, unknown>;
  const rawA = extractRawVariant(args.variantA);
  const rawB = extractRawVariant(args.variantB);
  const rawC = extractRawVariant(args.variantC);

  let variants: VariantOut[] = [rawA, rawB, rawC]
    .filter((r) => r.copy)
    .map((r) => finalizeVariant(r, platform, body));

  // If any variant still scores HIGH after rewrite, try ONE retry with a fresh seed.
  if (variants.some((v) => v.risk === "high")) {
    const seed2 = makePlatformSeed(platform, body.tone);
    const prompt2 = buildPlatformPrompt(
      body,
      platform,
      renderPlatformSeedBlock(seed2),
      [
        renderRecentSocialBlock(recent),
        `PREVIOUS DRAFT WAS REJECTED for compliance. Be even more careful — no high-risk vocabulary, include disclaimer, reference GEO if provided.`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
    const ai2 = await callClaudeWithTool(prompt2, SOCIAL_TOOL, { temperature: 0.7, top_p: 0.9 });
    if (ai2.ok) {
      const args2 = ai2.args as Record<string, unknown>;
      const retry = [extractRawVariant(args2.variantA), extractRawVariant(args2.variantB), extractRawVariant(args2.variantC)]
        .filter((r) => r.copy)
        .map((r) => finalizeVariant(r, platform, body));
      // Replace any high-risk variant with the corresponding retry if it's lower-risk.
      variants = variants.map((v, i) => {
        if (v.risk !== "high") return v;
        const r = retry[i];
        if (r && (r.risk === "low" || r.risk === "medium")) return r;
        return v;
      });
    }
  }

  // Persist memory (best-effort).
  void saveRecentSocial(siteId, platform, body.tone, variants.map((v) => v.copy)).catch(() => {});

  return { platform, variants };
}

export const Route = createFileRoute("/api/generate-social")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as SocialBody;

          // Validation
          if (!body.tone || typeof body.tone !== "string") {
            return Response.json({ error: "Tone is required." }, { status: 400 });
          }
          if (!Array.isArray(body.platforms) || body.platforms.length === 0) {
            return Response.json({ error: "Pick at least one platform." }, { status: 400 });
          }
          const platforms = body.platforms.filter(isPlatform);
          if (platforms.length === 0) {
            return Response.json({ error: "No valid platforms selected." }, { status: 400 });
          }
          if (platforms.length > 5) {
            return Response.json({ error: "Too many platforms." }, { status: 400 });
          }
          if (
            tooLong(body.brandName, 200) ||
            tooLong(body.promotionName, 300) ||
            tooLong(body.promotionUrl, 500) ||
            tooLong(body.topic, 1000) ||
            tooLong(body.geo, 200) ||
            tooLong(body.siteId, 200)
          ) {
            return Response.json({ error: "One or more fields exceed the allowed length." }, { status: 400 });
          }
          if (body.promotionUrl && body.promotionUrl.trim()) {
            try {
              new URL(body.promotionUrl);
            } catch {
              return Response.json({ error: "Promotion URL must be a valid URL." }, { status: 400 });
            }
          }

          // Fan out per platform in parallel.
          const results = await Promise.all(
            platforms.map((p) => generateForPlatform(body, p)),
          );

          return Response.json({ platforms: results });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
