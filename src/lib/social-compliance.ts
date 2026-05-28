// Shared compliance rules for the Social Media generator.
// Derived from AI_Compliance_Rules_2.pdf — keep this single source of truth.

export type SocialPlatform = "facebook" | "instagram" | "x" | "tiktok" | "telegram";
export type SocialTone = "fun" | "informative" | "community" | "hype" | "soft";
export type RiskLevel = "low" | "medium" | "high";

export const SOCIAL_PLATFORMS: { id: SocialPlatform; label: string }[] = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "x", label: "X (Twitter)" },
  { id: "tiktok", label: "TikTok" },
  { id: "telegram", label: "Telegram" },
];

export const SOCIAL_TONES: { id: SocialTone; label: string; desc: string }[] = [
  { id: "fun", label: "Fun & playful", desc: "Light, witty, emoji-friendly" },
  { id: "informative", label: "Informative", desc: "Clear, factual, brand voice" },
  { id: "community", label: "Community", desc: "Conversational, asks a question" },
  { id: "hype", label: "Hype", desc: "High energy but compliance-safe" },
  { id: "soft", label: "Soft brand", desc: "Minimal, brand-update style" },
];

// PDF §1 High-risk terms — never allowed.
export const HIGH_RISK_TERMS: string[] = [
  "deposit now", "play now", "win big", "guaranteed win", "cash out",
  "free money", "instant payout", "jackpot tonight", "one spin can change everything",
  "make money", "risk-free", "risk free", "limited time claim", "bonus code", "bet now",
  "claim now", "win now", "you just won", "you won", "you've won", "guaranteed",
  "click here", "click link", "tap here",
];

// PDF §1 Medium-risk terms — allowed sparingly with a disclaimer.
export const MEDIUM_RISK_TERMS: string[] = [
  "bonus", "deposit bonus", "reload", "jackpot", "lucky", "cash", "payout",
  "spin", "vip win", "free credits", "reward", "claim",
];

// PDF §2 Safer alternatives.
export const SAFER_ALTERNATIVES: Record<string, string> = {
  "play now": "explore details",
  "deposit now": "check offer terms",
  "win big": "explore what's available",
  "guaranteed win": "explore what's available",
  "free money": "welcome offer, T&Cs apply",
  "cash out": "manage your session responsibly",
  "bonus code": "offer details",
  "jackpot tonight": "game feature spotlight",
  "claim now": "see details",
  "win now": "see details",
  "bet now": "explore details",
  "make money": "see details",
  "risk-free": "see eligibility details",
  "risk free": "see eligibility details",
  "instant payout": "session details",
  "one spin can change everything": "game feature spotlight",
  "limited time claim": "see offer terms",
  "click here": "see details",
  "click link": "see details",
  "tap here": "see details",
  "guaranteed": "available",
  "you won": "details available",
  "you've won": "details available",
  "you just won": "details available",
};

// Per-platform policy rules.
export type PlatformPolicy = {
  label: string;
  maxLength: number;
  allowLink: boolean;
  allowHashtags: boolean;
  emojiPolicy: "rich" | "light" | "minimal" | "none";
  disclaimer: string;
  forbiddenExtra: string[]; // platform-specific bans
  styleNote: string;
  hashtagPool: string[];
};

export const PLATFORM_POLICIES: Record<SocialPlatform, PlatformPolicy> = {
  facebook: {
    label: "Facebook",
    maxLength: 600,
    allowLink: true,
    allowHashtags: true,
    emojiPolicy: "light",
    disclaimer: "21+. T&Cs apply. Play responsibly. Available in eligible locations only.",
    forbiddenExtra: [],
    styleNote: "Soft CTA only (e.g. 'Explore details', 'Check eligibility'). Friendly, brand-update tone. Avoid hard sells.",
    hashtagPool: ["#GameNight", "#CommunityUpdate", "#ResponsibleGaming", "#PlaySmart"],
  },
  instagram: {
    label: "Instagram",
    maxLength: 600,
    allowLink: false, // IG captions don't support clickable links; we point to "link in bio"
    allowHashtags: true,
    emojiPolicy: "rich",
    disclaimer: "21+. T&Cs apply. Play responsibly. Eligible locations only.",
    forbiddenExtra: [],
    styleNote: "Caption-style, scroll-stopping first line, then a short body. Reference 'link in bio' instead of pasting a URL.",
    hashtagPool: ["#GameSpotlight", "#PlayResponsibly", "#CommunityVibes", "#WeekendMode", "#NewDrop"],
  },
  x: {
    label: "X (Twitter)",
    maxLength: 270,
    allowLink: true,
    allowHashtags: true,
    emojiPolicy: "minimal",
    disclaimer: "21+ · T&Cs apply · Play responsibly",
    forbiddenExtra: ["affiliate", "promo code", "bonus code", "voucher", "tips", "odds"],
    styleNote: "Short and punchy. Brand update, community question, or responsible-gaming reminder. No affiliate, no betting CTA.",
    hashtagPool: ["#BrandUpdate", "#Community", "#PlayResponsibly"],
  },
  tiktok: {
    label: "TikTok",
    maxLength: 280,
    allowLink: false, // organic-only per PDF §4
    allowHashtags: true,
    emojiPolicy: "rich",
    disclaimer: "21+. Play responsibly.",
    forbiddenExtra: ["visit site", "play now", "claim bonus", "deposit", "link in bio for deposit"],
    styleNote: "ORGANIC ONLY. No deposit CTA, no real-money gambling link, no win promises. Angle: community update, game feature awareness, responsible play, or platform information.",
    hashtagPool: ["#CommunityUpdate", "#GameFeature", "#PlayResponsibly", "#fyp", "#viral"],
  },
  telegram: {
    label: "Telegram",
    maxLength: 700,
    allowLink: true,
    allowHashtags: false,
    emojiPolicy: "minimal",
    disclaimer: "21+. T&Cs apply. Play responsibly. Eligible locations only.",
    forbiddenExtra: ["urgent", "hurry", "last chance", "act now", "you just won"],
    styleNote: "Treat as organic announcement. No urgency, no deposit pressure, no guaranteed reward claims. Community update / eligibility reminder / platform info style.",
    hashtagPool: [],
  },
};

// ---- helpers ----

function buildPattern(terms: string[]): RegExp {
  const escaped = terms
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length); // longest first
  return new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
}

const HIGH_RE = buildPattern(HIGH_RISK_TERMS);
const MED_RE = buildPattern(MEDIUM_RISK_TERMS);

export function findHighRiskHits(text: string): string[] {
  const hits = text.match(HIGH_RE);
  return hits ? Array.from(new Set(hits.map((s) => s.toLowerCase()))) : [];
}

export function findMediumRiskHits(text: string): string[] {
  const hits = text.match(MED_RE);
  return hits ? Array.from(new Set(hits.map((s) => s.toLowerCase()))) : [];
}

export function findPlatformExtraHits(text: string, platform: SocialPlatform): string[] {
  const extras = PLATFORM_POLICIES[platform].forbiddenExtra;
  if (extras.length === 0) return [];
  const re = buildPattern(extras);
  const hits = text.match(re);
  return hits ? Array.from(new Set(hits.map((s) => s.toLowerCase()))) : [];
}

/**
 * Mechanically swap every high-risk phrase with its safer alternative.
 * Falls back to "see details" for any phrase not in the map.
 */
export function autoRewriteHighRisk(text: string): string {
  return text.replace(HIGH_RE, (match) => {
    const lower = match.toLowerCase();
    return SAFER_ALTERNATIVES[lower] ?? "see details";
  });
}

/**
 * PDF §8 risk scoring.
 *
 * High → any banned term survives, missing GEO on US iGaming, forbidden CTA
 * Medium → medium-risk vocab present OR disclaimer missing
 * Low → soft copy, disclaimer present, GEO clear, safe CTA
 */
export type ScoreInput = {
  text: string;
  platform: SocialPlatform;
  hasDisclaimer: boolean;
  hasGeo: boolean;
  isUsIgaming: boolean;
};

export type ScoreResult = {
  risk: RiskLevel;
  reasons: string[];
  highHits: string[];
  mediumHits: string[];
  platformHits: string[];
};

export function scoreVariant(input: ScoreInput): ScoreResult {
  const highHits = findHighRiskHits(input.text);
  const mediumHits = findMediumRiskHits(input.text);
  const platformHits = findPlatformExtraHits(input.text, input.platform);
  const reasons: string[] = [];
  let risk: RiskLevel = "low";

  if (highHits.length > 0) {
    risk = "high";
    reasons.push(`High-risk term${highHits.length > 1 ? "s" : ""}: ${highHits.join(", ")}`);
  }
  if (platformHits.length > 0) {
    risk = "high";
    reasons.push(`Forbidden on ${PLATFORM_POLICIES[input.platform].label}: ${platformHits.join(", ")}`);
  }
  if (input.isUsIgaming && !input.hasGeo) {
    risk = "high";
    reasons.push("US iGaming requires explicit GEO");
  }

  if (risk !== "high") {
    if (mediumHits.length > 0) {
      risk = "medium";
      reasons.push(`Medium-risk vocab: ${mediumHits.join(", ")}`);
    }
    if (!input.hasDisclaimer) {
      risk = risk === "low" ? "medium" : risk;
      reasons.push("Disclaimer missing");
    }
  }

  if (reasons.length === 0) {
    reasons.push("Soft copy, disclaimer present, GEO clear, safe CTA");
  }

  return { risk, reasons, highHits, mediumHits, platformHits };
}

export function detectGeoInText(text: string, geoHint: string): boolean {
  if (!geoHint.trim()) return false;
  const haystack = text.toLowerCase();
  // Match any whitespace/comma-separated token from the GEO hint.
  const tokens = geoHint
    .toLowerCase()
    .split(/[\s,/|]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  return tokens.some((t) => haystack.includes(t));
}

export function detectDisclaimerInText(text: string, platform: SocialPlatform): boolean {
  const lower = text.toLowerCase();
  // Any of these markers counts.
  return (
    lower.includes("21+") ||
    lower.includes("t&cs") ||
    lower.includes("t&c") ||
    lower.includes("play responsibly") ||
    lower.includes("eligible locations") ||
    (platform === "tiktok" && lower.includes("responsibly"))
  );
}
