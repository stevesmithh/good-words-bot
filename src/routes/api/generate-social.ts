import { createFileRoute } from "@tanstack/react-router";
import { callClaudeWithTool } from "@/server/anthropic.server";
import {
  PLATFORM_POLICIES,
  SOCIAL_PLATFORMS,
  autoRewriteHighRisk,
  detectDisclaimerInText,
  scoreVariant,
  getToneSpec,
  scanInputForHardBlocks,
  findHardBlockOutputHits,
  noveltyAllowed,
  findNoveltyHits,
  findFabricationCandidates,
  type AuditEntry,
  type RiskLevel,
  type SocialPlatform,
  type SocialTone,
} from "@/lib/social-compliance";
import {
  fetchRecentSocial,
  makePlatformSeed,
  renderPlatformSeedBlock,
  renderRecentSocialBlock,
  saveRecentSocial,
} from "@/server/social-variation.server";

type BriefFacts = {
  offerName?: string;
  offerAmount?: string;
  promoCode?: string;
  gameTitles?: string;
};

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
  facts?: BriefFacts;
};

type VariantOut = {
  copy: string;
  hashtags: string[];
  risk: RiskLevel;
  reasons: string[];
  rewritten: boolean;
  blocked?: boolean;
  audit: AuditEntry[];
  missing_elements: string[];
  risk_reason: string;
};

type PlatformOut = {
  platform: SocialPlatform;
  variants: VariantOut[];
  error?: string;
};

const ALL_PLATFORM_IDS = SOCIAL_PLATFORMS.map((p) => p.id);
const VALID_TONES: SocialTone[] = ["promotional", "friendly", "informational"];

function isPlatform(v: unknown): v is SocialPlatform {
  return typeof v === "string" && (ALL_PLATFORM_IDS as string[]).includes(v);
}

function tooLong(s: string | undefined, max: number): boolean {
  return typeof s === "string" && s.length > max;
}

function factsList(facts: BriefFacts): string[] {
  return [facts.offerName, facts.offerAmount, facts.promoCode, facts.gameTitles]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .map((v) => v.trim());
}

function renderBriefFacts(facts: BriefFacts): string {
  const sentinel = "NOT PROVIDED — do not include";
  const row = (label: string, v?: string) =>
    `- ${label}: ${v && v.trim() ? v.trim() : sentinel}`;
  return [
    "BRIEF FACTS (only these specific details may be referenced verbatim — do NOT invent any others):",
    row("Offer name", facts.offerName),
    row("Offer amount", facts.offerAmount),
    row("Promo code", facts.promoCode),
    row("Game titles", facts.gameTitles),
  ].join("\n");
}

function buildPlatformPrompt(
  body: SocialBody,
  platform: SocialPlatform,
  seedBlock: string,
  recentBlock: string,
  retryNote?: string,
): string {
  const policy = PLATFORM_POLICIES[platform];
  const tone = getToneSpec(body.tone);
  const brand = body.brandName?.trim() || body.siteId?.trim() || "the brand";
  const promo = body.promotionName?.trim() || "the current promotion";
  const topic = body.topic?.trim() || "(none — write a general brand-safe update tied to the promotion)";
  const facts = body.facts ?? {};
  const linkLine =
    policy.allowLink && body.promotionUrl
      ? `Link to include at the end (verbatim, do NOT modify): ${body.promotionUrl}`
      : platform === "instagram"
        ? `Do NOT paste a URL. Reference "link in bio" instead.`
        : `Do NOT include any URL.`;
  const novelty = noveltyAllowed(topic);

  return `You are a senior iGaming social-media copywriter writing for ${policy.label}. Your output MUST pass strict gambling-compliance review (Meta/TikTok/X/Telegram). Engaging and human, but never spammy and never high-risk.

BRAND: ${brand}
PROMOTION: ${promo}
CORE IDEA / ANGLE (authoritative — this is the brief; every variant must clearly reflect it): ${topic}
TONE: ${tone.label}

TONE RULES (${tone.label} — follow EXACTLY, do not blend with other tones):
${tone.rules.map((r) => `- ${r}`).join("\n")}

${renderBriefFacts(facts)}

FABRICATION RULE — STRICTLY ENFORCED:
- You MUST NOT invent, guess, or assume any of the following:
  promo codes (e.g. "GEMS20", "JOINUS"), monetary amounts (e.g. "$20 credit", "100 free spins"), percentage values (e.g. "200% match"), reward/tier names not provided, game titles not provided, URLs or app names not provided.
- If a BRIEF FACTS row says "NOT PROVIDED — do not include", you must NOT include that kind of detail at all (no substitute, no placeholder).
- If the brief does not include a promo code, the copy MUST NOT contain one — not even a fake or example one.
- Generic phrasing is the fallback. E.g. instead of "$20 credit" write "a welcome credit" ONLY if the brief mentions a credit exists; otherwise do not reference it.
- Populate "details_used" with every concrete fact you reference from BRIEF FACTS; if you used none, return an empty array.

GEO RULE:
- Do NOT include geographic references (e.g. "US players", "available in the US", "across the United States", state names) inside the caption body.
- Eligibility appears ONLY inside the disclaimer line, using the phrase "Available in eligible locations only." (already in the platform disclaimer below).
- NEVER reference a country, state, or region by name in the main copy. The TARGET GEO field is for our internal targeting and must not appear in the copy.

NOVELTY / TIMING RULE:
- NOVELTY_ALLOWED: ${novelty ? "true" : "false"}.
- ${novelty
    ? "The brief explicitly signals novelty/timing, so launch-style language is permitted but must stay restrained."
    : "Do NOT use language that implies the promotion is new, just launched, or time-limited. Treat it as ongoing and evergreen."}
- ${novelty ? "Avoid screaming urgency (no 'act fast', no 'don't miss this')." : "Hard-blocked phrases (instant compliance fail): \"just launched\", \"now live\", \"introducing\", \"brand new\", \"for the first time\", \"dropping now\", \"this week only\", \"don't miss this\", \"limited time\", \"act fast\", \"new promotion\"."}

PLATFORM POLICY (${policy.label}):
- Max length: ${policy.maxLength} characters total.
- ${policy.styleNote}
- Hashtags: ${policy.allowHashtags ? "use 2–5 tasteful, on-brand hashtags" : "do NOT use hashtags"}.
- Emoji policy: ${policy.emojiPolicy} (overridden by TONE RULES if stricter).
- ${linkLine}
- Append this exact disclaimer at the end (before any link): "${policy.disclaimer}"

ABSOLUTE BANS — these phrases are NEVER allowed in any variant (instant compliance fail, will be rejected):
play now, deposit now, claim now, win now, win big, free money, guaranteed win, guaranteed earn, guaranteed earnings, guaranteed payout, guaranteed return, cash out, bonus code, jackpot tonight, instant payout, instant withdrawal, instant cash, risk-free, risk free, no risk, bet now, make money, one spin can change everything, click here, click link, tap here, you won, you've won, you just won, you will win, certain to win, 100% win, always pays out, guaranteed.
${policy.forbiddenExtra.length > 0 ? `Also forbidden specifically on ${policy.label}: ${policy.forbiddenExtra.join(", ")}.` : ""}

SOFT-USE WORDS — medium-risk; use AT MOST ONCE across the three variants combined, and only if a disclaimer is in the same variant:
bonus, deposit bonus, reload, jackpot, lucky, cash, payout, spin, vip win, free credits, reward, claim.

${seedBlock}

${recentBlock}

${retryNote ? `IMPORTANT RETRY NOTE:\n${retryNote}\n` : ""}

OUTPUT — return THREE variants using the provided tool. For each variant include:
- "copy": full post text including disclaimer${policy.allowLink && body.promotionUrl ? " and the link at the very end" : ""}.
- "hashtags": ${policy.allowHashtags ? "array of 2–5 hashtag strings (with #)" : "an empty array []"}.
- "details_used": array of exact facts you referenced from BRIEF FACTS (empty if none).
- "compliance_audit": array of {original_term, replacement, reason, risk_level, rule_reference} for every change you made vs. the original brief vocabulary.
- "overall_risk": "Low" | "Medium" | "High".
- "risk_reason": one-sentence summary of why.
- "missing_elements": list any required elements missing (e.g. "Disclaimer missing").

Before returning, RE-READ each variant and confirm:
- It follows the TONE RULES above exactly and sounds distinctly different from the other two variants.
- It contains NO banned phrase and NO geographic name in the body.
- It references NO promo code, amount, percentage, or game title not in BRIEF FACTS.
If any check fails, rewrite that variant before returning.`;
}

const VARIANT_SCHEMA = {
  type: "object",
  properties: {
    copy: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
    details_used: { type: "array", items: { type: "string" } },
    compliance_audit: {
      type: "array",
      items: {
        type: "object",
        properties: {
          original_term: { type: "string" },
          replacement: { type: "string" },
          reason: { type: "string" },
          risk_level: { type: "string", enum: ["High", "Medium", "Low"] },
          rule_reference: { type: "string" },
        },
        required: ["original_term", "replacement", "reason", "risk_level", "rule_reference"],
      },
    },
    overall_risk: { type: "string", enum: ["Low", "Medium", "High"] },
    risk_reason: { type: "string" },
    missing_elements: { type: "array", items: { type: "string" } },
  },
  required: ["copy", "hashtags", "details_used", "compliance_audit", "overall_risk", "risk_reason", "missing_elements"],
};

const SOCIAL_TOOL = {
  type: "function" as const,
  function: {
    name: "return_social_posts",
    description: "Return three platform-specific social media post variants with compliance audit.",
    parameters: {
      type: "object",
      properties: {
        variantA: VARIANT_SCHEMA,
        variantB: VARIANT_SCHEMA,
        variantC: VARIANT_SCHEMA,
      },
      required: ["variantA", "variantB", "variantC"],
      additionalProperties: false,
    },
  },
};

type RawVariant = {
  copy: string;
  hashtags: string[];
  details_used: string[];
  compliance_audit: AuditEntry[];
  overall_risk: "Low" | "Medium" | "High";
  risk_reason: string;
  missing_elements: string[];
};

function extractRawVariant(raw: unknown): RawVariant {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const audit = Array.isArray(r.compliance_audit)
    ? (r.compliance_audit as unknown[])
        .map((e) => {
          const o = (e && typeof e === "object" ? e : {}) as Record<string, unknown>;
          const rl = typeof o.risk_level === "string" ? o.risk_level : "Low";
          return {
            original_term: typeof o.original_term === "string" ? o.original_term : "",
            replacement: typeof o.replacement === "string" ? o.replacement : "",
            reason: typeof o.reason === "string" ? o.reason : "",
            risk_level: (["High", "Medium", "Low"].includes(rl) ? rl : "Low") as "High" | "Medium" | "Low",
            rule_reference: typeof o.rule_reference === "string" ? o.rule_reference : "",
          };
        })
        .filter((e) => e.original_term || e.replacement)
    : [];
  const overall = typeof r.overall_risk === "string" && ["Low", "Medium", "High"].includes(r.overall_risk)
    ? (r.overall_risk as "Low" | "Medium" | "High")
    : "Low";
  return {
    copy: typeof r.copy === "string" ? r.copy : "",
    hashtags: Array.isArray(r.hashtags) ? (r.hashtags as unknown[]).filter((h): h is string => typeof h === "string") : [],
    details_used: Array.isArray(r.details_used) ? (r.details_used as unknown[]).filter((h): h is string => typeof h === "string") : [],
    compliance_audit: audit,
    overall_risk: overall,
    risk_reason: typeof r.risk_reason === "string" ? r.risk_reason : "",
    missing_elements: Array.isArray(r.missing_elements) ? (r.missing_elements as unknown[]).filter((h): h is string => typeof h === "string") : [],
  };
}

type ValidationProblem =
  | { kind: "hard-block"; details: string[] }
  | { kind: "novelty"; details: string[] }
  | { kind: "fabrication"; details: string[] };

function validateOutput(copy: string, body: SocialBody): ValidationProblem[] {
  const problems: ValidationProblem[] = [];
  const hb = findHardBlockOutputHits(copy);
  if (hb.length) problems.push({ kind: "hard-block", details: hb });
  if (!noveltyAllowed(body.topic ?? "")) {
    const nv = findNoveltyHits(copy);
    if (nv.length) problems.push({ kind: "novelty", details: nv });
  }
  const facts = factsList(body.facts ?? {});
  const fb = findFabricationCandidates(copy, facts);
  if (fb.length) problems.push({ kind: "fabrication", details: fb.map((h) => `${h.kind}:${h.value}`) });
  return problems;
}

function ucFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function finalizeVariant(
  raw: RawVariant,
  platform: SocialPlatform,
  body: SocialBody,
  serverProblems: ValidationProblem[],
): VariantOut {
  let copy = raw.copy;
  let rewritten = false;
  // Soft rewrite (medium-risk only — hard-blocks already triggered regen).
  const rewritten1 = autoRewriteHighRisk(copy);
  if (rewritten1 !== copy) {
    copy = rewritten1;
    rewritten = true;
  }
  const score = scoreVariant({
    text: copy,
    platform,
    hasDisclaimer: detectDisclaimerInText(copy, platform),
    isUsIgaming: !!body.isUsIgaming,
  });

  // Server-authoritative audit entries appended to the model's audit.
  const serverAudit: AuditEntry[] = [];
  for (const p of serverProblems) {
    if (p.kind === "hard-block") {
      for (const d of p.details) {
        serverAudit.push({
          original_term: d,
          replacement: "(blocked — variant regenerated)",
          reason: "Hard-block compliance phrase detected and regenerated.",
          risk_level: "High",
          rule_reference: "Hard-block list (Issue 4)",
        });
      }
    } else if (p.kind === "novelty") {
      for (const d of p.details) {
        serverAudit.push({
          original_term: d,
          replacement: "(removed — no novelty signal in brief)",
          reason: "Novelty/timing language not permitted unless brief signals it.",
          risk_level: "Medium",
          rule_reference: "Novelty rule (Issue 3)",
        });
      }
    } else {
      for (const d of p.details) {
        serverAudit.push({
          original_term: d,
          replacement: "(fabrication risk — please verify)",
          reason: "Concrete detail not present in BRIEF FACTS.",
          risk_level: "High",
          rule_reference: "Fabrication rule (Issue 5)",
        });
      }
    }
  }

  const missing: string[] = [...raw.missing_elements];
  if (!detectDisclaimerInText(copy, platform) && !missing.find((m) => /disclaim/i.test(m))) {
    missing.push("Disclaimer missing");
  }

  // Final risk = max(score.risk, model overall_risk, server problems severity)
  const order: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
  const modelRisk = raw.overall_risk.toLowerCase() as RiskLevel;
  let finalRisk: RiskLevel = score.risk;
  if (order[modelRisk] > order[finalRisk]) finalRisk = modelRisk;
  if (serverProblems.some((p) => p.kind === "hard-block" || p.kind === "fabrication")) finalRisk = "high";
  else if (serverProblems.some((p) => p.kind === "novelty") && order[finalRisk] < 1) finalRisk = "medium";

  return {
    copy,
    hashtags: raw.hashtags.slice(0, 6),
    risk: finalRisk,
    reasons: score.reasons,
    rewritten,
    audit: [...serverAudit, ...raw.compliance_audit],
    missing_elements: missing,
    risk_reason: raw.risk_reason || score.reasons.join(" · "),
  };
}

async function generateForPlatform(
  body: SocialBody,
  platform: SocialPlatform,
): Promise<PlatformOut> {
  const siteId = body.siteId?.trim() || null;
  const seed = makePlatformSeed(platform, body.tone);
  const recent = await fetchRecentSocial(siteId, platform, body.tone, 8);

  const runOnce = async (retryNote?: string) => {
    const prompt = buildPlatformPrompt(
      body,
      platform,
      renderPlatformSeedBlock(seed),
      renderRecentSocialBlock(recent),
      retryNote,
    );
    const ai = await callClaudeWithTool(prompt, SOCIAL_TOOL, { temperature: 0.85, top_p: 0.9 });
    if (!ai.ok) return { ok: false as const, error: ai.error };
    const args = ai.args as Record<string, unknown>;
    return {
      ok: true as const,
      raws: [extractRawVariant(args.variantA), extractRawVariant(args.variantB), extractRawVariant(args.variantC)],
    };
  };

  const first = await runOnce();
  if (!first.ok) return { platform, variants: [], error: first.error };

  // Per-variant validation + regen for hard-block / fabrication / novelty.
  const finals: VariantOut[] = [];
  for (let i = 0; i < first.raws.length; i++) {
    let raw = first.raws[i];
    if (!raw.copy) continue;

    let serverProblems = validateOutput(raw.copy, body);
    let attempts = 0;
    while (
      attempts < 2 &&
      serverProblems.some((p) => p.kind === "hard-block" || p.kind === "fabrication" || p.kind === "novelty")
    ) {
      attempts++;
      const reasons = serverProblems
        .flatMap((p) => p.details.map((d) => `${ucFirst(p.kind)}: ${d}`))
        .join("; ");
      const retry = await runOnce(
        `Variant ${String.fromCharCode(65 + i)} was rejected by the compliance scanner. Issues: ${reasons}. Rewrite ALL three variants again, avoiding those issues and any semantic equivalents.`,
      );
      if (!retry.ok) break;
      raw = retry.raws[i] ?? raw;
      if (!raw.copy) break;
      serverProblems = validateOutput(raw.copy, body);
    }

    const final = finalizeVariant(raw, platform, body, serverProblems);
    // If still hard-blocked after retries, mark blocked and hide copy.
    if (serverProblems.some((p) => p.kind === "hard-block")) {
      final.blocked = true;
      final.copy = "";
      final.risk = "high";
      final.risk_reason = "Could not produce compliant copy after retries — refine your brief and try again.";
    }
    finals.push(final);
  }

  void saveRecentSocial(siteId, platform, body.tone, finals.filter((v) => v.copy).map((v) => v.copy)).catch(() => {});
  return { platform, variants: finals };
}

export const Route = createFileRoute("/api/generate-social")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as SocialBody;

          if (!body.tone || !VALID_TONES.includes(body.tone)) {
            return Response.json({ error: "Tone is required (promotional, friendly, or informational)." }, { status: 400 });
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
            tooLong(body.siteId, 200) ||
            tooLong(body.facts?.offerName, 200) ||
            tooLong(body.facts?.offerAmount, 80) ||
            tooLong(body.facts?.promoCode, 80) ||
            tooLong(body.facts?.gameTitles, 300)
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

          // Server-side input hard-block check (Issue 4 Layer 1 backstop).
          const inputBlob = [body.topic, body.promotionName, body.facts?.offerName, body.facts?.offerAmount, body.facts?.promoCode, body.facts?.gameTitles]
            .filter(Boolean)
            .join(" \n ");
          const inputHits = scanInputForHardBlocks(inputBlob);
          if (inputHits.length > 0) {
            return Response.json(
              {
                error: `Brief contains blocked phrase${inputHits.length > 1 ? "s" : ""}: ${inputHits.map((h) => `"${h.term}"`).join(", ")}. Remove or replace before generating.`,
                inputHits,
              },
              { status: 400 },
            );
          }

          const results = await Promise.all(platforms.map((p) => generateForPlatform(body, p)));
          return Response.json({ platforms: results });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
