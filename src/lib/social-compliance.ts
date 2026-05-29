// Shared compliance + tone rules for the Social Media generator.
// Single source of truth for platform policy, tone rulebooks, and hard-block lists.

export type SocialPlatform = "facebook" | "instagram" | "x" | "tiktok" | "telegram";
export type SocialTone = "promotional" | "friendly" | "informational";
export type RiskLevel = "low" | "medium" | "high";

export const SOCIAL_PLATFORMS: { id: SocialPlatform; label: string }[] = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "x", label: "X (Twitter)" },
  { id: "tiktok", label: "TikTok" },
  { id: "telegram", label: "Telegram" },
];

// ---------- Tone rulebook (Issue 1) ----------

export type ToneSpec = {
  id: SocialTone;
  label: string;
  desc: string;
  rules: string[];
};

export const SOCIAL_TONES: ToneSpec[] = [
  {
    id: "promotional",
    label: "Promotional",
    desc: "High-energy, short, punchy",
    rules: [
      "Use short punchy sentences (max 10 words each).",
      "Open with an action-oriented statement about the feature or offer.",
      "Use 1-2 emojis maximum, placed at the end of lines, never mid-sentence.",
      "Sentence rhythm: short. medium. short. slightly longer. short.",
      "Avoid filler phrases like 'we are excited to' or 'check it out'.",
      "Do NOT use warm or conversational language. Stay high-energy but controlled.",
    ],
  },
  {
    id: "friendly",
    label: "Friendly",
    desc: "Warm, conversational, you-focused",
    rules: [
      "Write as if addressing a friend, using 'you' and 'your' frequently.",
      "Open with a question or relatable observation.",
      "Vary sentences: one long flowing sentence, then one short punchy one.",
      "Use warm word choices: discover, explore, enjoy, together, your way.",
      "Avoid exclamation marks except once at most.",
      "Do NOT use hype language or urgency phrases.",
    ],
  },
  {
    id: "informational",
    label: "Informational",
    desc: "Neutral, factual, brand-update voice",
    rules: [
      "Lead with a factual statement about what is available or how it works.",
      "Structure: What it is → Who it is for → How to find out more.",
      "Use NO emojis.",
      "Use neutral, clear, direct language.",
      "Avoid claim adjectives ('amazing', 'huge', 'exclusive').",
      "The disclaimer must read as a natural part of the copy, not appended.",
    ],
  },
];

export function getToneSpec(id: SocialTone): ToneSpec {
  return SOCIAL_TONES.find((t) => t.id === id) ?? SOCIAL_TONES[0];
}

// ---------- High / medium risk vocabulary ----------

export const HIGH_RISK_TERMS: string[] = [
  "deposit now", "play now", "win big", "guaranteed win", "cash out",
  "free money", "instant payout", "jackpot tonight", "one spin can change everything",
  "make money", "risk-free", "risk free", "limited time claim", "bonus code", "bet now",
  "claim now", "win now", "you just won", "you won", "you've won", "guaranteed",
  "click here", "click link", "tap here",
];

export const MEDIUM_RISK_TERMS: string[] = [
  "bonus", "deposit bonus", "reload", "jackpot", "lucky", "cash", "payout",
  "spin", "vip win", "free credits", "reward", "claim",
];

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

// ---------- HARD BLOCK (Issue 4 — input pre-screen) ----------

// Concrete phrases the user must remove from their brief before generation runs.
export const HARD_BLOCK_INPUT_TERMS: { term: string; safer: string }[] = [
  { term: "guaranteed win", safer: "available game feature" },
  { term: "guarantee a win", safer: "available game feature" },
  { term: "guaranteed to win", safer: "available game feature" },
  { term: "guaranteed earn", safer: "available reward feature" },
  { term: "guaranteed earnings", safer: "available reward feature" },
  { term: "instant payout", safer: "session details" },
  { term: "instant withdrawal", safer: "withdrawal details" },
  { term: "risk-free", safer: "see eligibility details" },
  { term: "risk free", safer: "see eligibility details" },
  { term: "free money", safer: "welcome offer, T&Cs apply" },
  { term: "no risk", safer: "see eligibility details" },
  { term: "you will win", safer: "available game feature" },
  { term: "certain to win", safer: "available game feature" },
  { term: "100% win", safer: "available game feature" },
  { term: "always pays out", safer: "available game feature" },
];

export type InputBlockHit = { term: string; safer: string };

export function scanInputForHardBlocks(text: string): InputBlockHit[] {
  if (!text) return [];
  const haystack = text.toLowerCase();
  const hits: InputBlockHit[] = [];
  for (const { term, safer } of HARD_BLOCK_INPUT_TERMS) {
    if (haystack.includes(term.toLowerCase())) hits.push({ term, safer });
  }
  return hits;
}

// ---------- HARD BLOCK (Issue 4 — output regenerate) ----------

// Patterns that, if found in model output, force a regenerate (no auto-rewrite).
export const HARD_BLOCK_OUTPUT_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "guaranteed-payoff", re: /\bguaranteed\s+(win|earn|reward|return|payout|earnings|winnings)\b/i },
  { name: "risk-free", re: /\brisk[- ]?free\b/i },
  { name: "instant-payoff", re: /\binstant\s+(payout|withdrawal|cash|win|winnings)\b/i },
  { name: "free-money", re: /\bfree\s+money\b/i },
  { name: "no-risk", re: /\bno\s+risk\b/i },
  { name: "you-will-win", re: /\byou\s+(will|are\s+going\s+to|gonna)\s+win\b/i },
  { name: "always-pays", re: /\balways\s+pays?\s+out\b/i },
];

export function findHardBlockOutputHits(text: string): string[] {
  return HARD_BLOCK_OUTPUT_PATTERNS
    .filter((p) => p.re.test(text))
    .map((p) => p.name);
}

// ---------- Novelty / timing rule (Issue 3) ----------

export const NOVELTY_TERMS: string[] = [
  "just launched", "now live", "introducing", "brand new", "for the first time",
  "dropping now", "this week only", "don't miss this", "limited time", "act fast",
  "new promotion", "newly launched", "just released",
];

export const NOVELTY_ALLOW_TRIGGERS: string[] = [
  "new", "launching", "just released", "limited time", "first time", "announcing", "launch",
];

export function noveltyAllowed(briefText: string): boolean {
  const t = (briefText || "").toLowerCase();
  return NOVELTY_ALLOW_TRIGGERS.some((trig) => new RegExp(`\\b${trig}\\b`, "i").test(t));
}

export function findNoveltyHits(text: string): string[] {
  const lower = text.toLowerCase();
  return NOVELTY_TERMS.filter((t) => lower.includes(t.toLowerCase()));
}

// ---------- Fabrication detection (Issue 5) ----------

// Tokens that look like promo codes (e.g. GEMS20, JOINUS, WELCOME50).
const PROMO_CODE_RE = /\b[A-Z][A-Z0-9]{3,}\b/g;
// $20, $1,000, USD 50
const MONEY_RE = /(?:\$|€|£|USD\s|EUR\s|GBP\s)\s?\d[\d,]*/gi;
// 200%, 50 %
const PERCENT_RE = /\b\d{1,3}\s?%/g;

export type FabricationHit = { kind: "code" | "money" | "percent"; value: string };

const COMMON_ACRONYMS = new Set([
  "USA", "US", "UK", "EU", "EUR", "USD", "VIP", "FAQ", "CTA", "URL", "API",
  "NJ", "PA", "MI", "MA", "NY", "CT", "WV", "T&CS", "TCS", "GEO",
]);

export function findFabricationCandidates(text: string, providedFacts: string[]): FabricationHit[] {
  const facts = providedFacts.map((f) => f.toLowerCase()).filter(Boolean);
  const hits: FabricationHit[] = [];
  const containsFact = (v: string) => facts.some((f) => f.includes(v.toLowerCase()) || v.toLowerCase().includes(f));

  for (const m of text.match(PROMO_CODE_RE) ?? []) {
    if (COMMON_ACRONYMS.has(m)) continue;
    if (containsFact(m)) continue;
    hits.push({ kind: "code", value: m });
  }
  for (const m of text.match(MONEY_RE) ?? []) {
    if (containsFact(m)) continue;
    hits.push({ kind: "money", value: m.trim() });
  }
  for (const m of text.match(PERCENT_RE) ?? []) {
    if (containsFact(m)) continue;
    hits.push({ kind: "percent", value: m.trim() });
  }
  return hits;
}

// ---------- Per-platform policy ----------

export type PlatformPolicy = {
  label: string;
  maxLength: number;
  allowLink: boolean;
  allowHashtags: boolean;
  emojiPolicy: "rich" | "light" | "minimal" | "none";
  disclaimer: string;
  forbiddenExtra: string[];
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
    allowLink: false,
    allowHashtags: true,
    emojiPolicy: "rich",
    disclaimer: "21+. T&Cs apply. Play responsibly. Available in eligible locations only.",
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
    allowLink: false,
    allowHashtags: true,
    emojiPolicy: "rich",
    disclaimer: "21+. Play responsibly. Available in eligible locations only.",
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
    disclaimer: "21+. T&Cs apply. Play responsibly. Available in eligible locations only.",
    forbiddenExtra: ["urgent", "hurry", "last chance", "act now", "you just won"],
    styleNote: "Treat as organic announcement. No urgency, no deposit pressure, no guaranteed reward claims. Community update / eligibility reminder / platform info style.",
    hashtagPool: [],
  },
};

// ---------- helpers ----------

function buildPattern(terms: string[]): RegExp {
  const escaped = terms
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);
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
 * Mechanically swap every (non-hard-block) high-risk phrase with its safer
 * alternative. Hard-block phrases are handled by regenerate, not rewrite.
 */
export function autoRewriteHighRisk(text: string): string {
  return text.replace(HIGH_RE, (match) => {
    const lower = match.toLowerCase();
    return SAFER_ALTERNATIVES[lower] ?? "see details";
  });
}

// ---------- Compliance audit output (Issue 6) ----------

export type AuditEntry = {
  original_term: string;
  replacement: string;
  reason: string;
  risk_level: "High" | "Medium" | "Low";
  rule_reference: string;
};

export type ComplianceReport = {
  audit: AuditEntry[];
  overall_risk: RiskLevel;
  risk_reason: string;
  missing_elements: string[];
};

// ---------- Scoring ----------

export type ScoreInput = {
  text: string;
  platform: SocialPlatform;
  hasDisclaimer: boolean;
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
    reasons.push("Soft copy, disclaimer present, safe CTA");
  }

  return { risk, reasons, highHits, mediumHits, platformHits };
}

export function detectDisclaimerInText(text: string, platform: SocialPlatform): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("21+") ||
    lower.includes("t&cs") ||
    lower.includes("t&c") ||
    lower.includes("play responsibly") ||
    lower.includes("eligible locations") ||
    (platform === "tiktok" && lower.includes("responsibly"))
  );
}
