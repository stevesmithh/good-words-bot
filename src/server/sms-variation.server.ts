// Server-only helpers for SMS variation:
// - Random "creative seed" injected into every prompt so each generation diverges.
// - Persistence of recent outputs per (site_id, sms_type, variant) so future
//   generations are told NOT to mirror them.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ───────────── Master pools (kept large to maximize divergence) ─────────────

const STANDARD_OPENERS = [
  "Heads up —",
  "Quick update:",
  "Good news —",
  "Just in:",
  "Something for you:",
  "A little something:",
  "Worth knowing:",
  "FYI:",
  "Just landed:",
  "Now live:",
  "Open for you:",
  "Ready when you are:",
  "Available now:",
  "On the table:",
  "Here's the deal:",
  "Take a look:",
  "Saved you a spot:",
  "You're in luck —",
  "Look at this:",
  "One for you:",
  "Got something:",
  "Picked this for you:",
  "Hot off the press:",
  "Newly added:",
  "Fresh drop:",
  "Special note:",
  "Quick heads up —",
  "Welcome back —",
  "Don't miss —",
  "Set aside for you:",
];

const CASUAL_CURIOSITY_OPENERS = [
  "okay so...",
  "wait —",
  "you're gonna want to see this",
  "this is kinda wild",
  "hold up",
  "saw this and thought of you",
  "this looks legit",
  "k so check this",
  "wait wait —",
  "actually this is cool",
  "this caught my eye",
  "thought you'd find this interesting",
  "had to share this",
  "this just hit different",
  "yo check it",
];

const CASUAL_FRIEND_OPENERS = [
  "heads up —",
  "thought you'd want this",
  "passing this along",
  "worth a peek",
  "this one's for you",
  "buddy this just dropped",
  "sending this your way",
  "thought of you when I saw this",
  "this has your name on it",
  "saving you the search —",
  "look what I found",
  "you'll like this one",
  "felt like I should tell you",
  "this seems like your thing",
  "passing the tip along",
];

const CASUAL_FYI_OPENERS = [
  "fyi",
  "quick one",
  "real quick",
  "psst",
  "just dropped",
  "live now",
  "k so this just popped up",
  "small note —",
  "tiny heads up",
  "btw",
  "quick fyi",
  "real fast —",
  "just a sec —",
  "two-second note",
  "low-key reminder",
];

const NOSPAM_OPENERS = [
  "A balance enhancement is currently available on your account.",
  "Your profile currently qualifies for an adjusted credit allocation.",
  "An adjusted balance update has been applied to your account.",
  "Your account is eligible for an additional balance credit.",
  "A pending balance update is available for your review.",
  "Your account currently has an active credit reference.",
  "A profile adjustment has been recorded on your account.",
  "An account-level credit has been made available to you.",
  "Your account tier currently includes an available adjustment.",
  "A new allocation reference is available on your profile.",
  "Account review complete — an additional credit is available.",
  "Your account has a pending balance enhancement awaiting use.",
];

const SENTENCE_SHAPES = [
  "single short statement",
  "two short fragments separated by a period",
  "two-clause sentence joined by an em-dash",
  "imperative line (start with a verb)",
  "short statement followed by a one-word emphasis",
  "comma-spliced casual fragment",
  "lowercase run-on with a single pause",
  "soft question shape (ends with ?)",
];

const TONE_MODIFIERS = [
  "playful",
  "matter-of-fact",
  "warm",
  "low-key",
  "curious",
  "direct",
  "understated",
  "easygoing",
  "encouraging",
  "deadpan",
];

const EMOJI_POLICIES = [
  "no emoji at all",
  "no emoji at all",
  "no emoji at all",
  "one optional emoji only if it fits naturally: 👀",
  "one optional emoji only if it fits naturally: 🎯",
  "one optional emoji only if it fits naturally: 🤝",
  "one optional emoji only if it fits naturally: 🎁",
  "one optional emoji only if it fits naturally: 🍀",
  "one optional emoji only if it fits naturally: ✨",
];

const VIBE_WORDS = [
  "fresh",
  "easy",
  "smooth",
  "low-key",
  "quiet",
  "warm",
  "neat",
  "tidy",
  "simple",
  "clean",
  "bright",
  "open",
  "ready",
  "set",
  "active",
  "live",
  "moving",
  "ticking",
  "rolling",
  "in motion",
  "in play",
  "on the table",
  "lined up",
  "waiting",
  "queued",
];

// ───────────── Helpers ─────────────

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

// ───────────── Creative seed ─────────────

export type VariantSeed = {
  openers: string[];
  shape: string;
  tone: string;
  emoji: string;
};

export type StandardCasualSeed = {
  message: VariantSeed;
  standardA: VariantSeed;
  standardB: VariantSeed;
  casualA: VariantSeed;
  casualB: VariantSeed;
  casualC: VariantSeed;
  vibeWord: string;
};

export type NoSpamSeed = {
  nospamA: VariantSeed;
  nospamB: VariantSeed;
  nospamC: VariantSeed;
};

function standardSeed(): VariantSeed {
  return {
    openers: pickN(STANDARD_OPENERS, 6),
    shape: pick(SENTENCE_SHAPES),
    tone: pick(TONE_MODIFIERS),
    emoji: "no emoji",
  };
}

function casualSeed(pool: readonly string[]): VariantSeed {
  return {
    openers: pickN(pool, 6),
    shape: pick(SENTENCE_SHAPES),
    tone: pick(TONE_MODIFIERS),
    emoji: pick(EMOJI_POLICIES),
  };
}

export function makeStandardCasualSeed(): StandardCasualSeed {
  return {
    message: standardSeed(),
    standardA: standardSeed(),
    standardB: standardSeed(),
    casualA: casualSeed(CASUAL_CURIOSITY_OPENERS),
    casualB: casualSeed(CASUAL_FRIEND_OPENERS),
    casualC: casualSeed(CASUAL_FYI_OPENERS),
    vibeWord: pick(VIBE_WORDS),
  };
}

export function makeNoSpamSeed(): NoSpamSeed {
  const openers = shuffle(NOSPAM_OPENERS);
  return {
    nospamA: { openers: [openers[0]], shape: "single statement", tone: "neutral", emoji: "no emoji" },
    nospamB: { openers: [openers[1]], shape: "single statement", tone: "neutral", emoji: "no emoji" },
    nospamC: { openers: [openers[2]], shape: "single statement", tone: "neutral", emoji: "no emoji" },
  };
}

// ───────────── Prompt blocks ─────────────

function seedBlock(label: string, seed: VariantSeed): string {
  return `  · ${label}: openers to choose from → ${seed.openers.map((o) => `"${o}"`).join(" | ")}; shape: ${seed.shape}; tone: ${seed.tone}; emoji: ${seed.emoji}.`;
}

export function renderStandardCasualSeedBlock(seed: StandardCasualSeed): string {
  return `VARIATION SEED (use these specific choices — do NOT default to your usual phrasing):
${seedBlock("message (standard primary)", seed.message)}
${seedBlock("standardA", seed.standardA)}
${seedBlock("standardB", seed.standardB)}
${seedBlock("casualA (curiosity)", seed.casualA)}
${seedBlock("casualB (friend-rec)", seed.casualB)}
${seedBlock("casualC (fyi)", seed.casualC)}
Vibe word you may optionally weave into ONE variant: "${seed.vibeWord}".`;
}

export function renderNoSpamSeedBlock(seed: NoSpamSeed): string {
  return `VARIATION SEED — each variant MUST start with its assigned opening sentence (you may continue from it):
  · nospamA opener: "${seed.nospamA.openers[0]}"
  · nospamB opener: "${seed.nospamB.openers[0]}"
  · nospamC opener: "${seed.nospamC.openers[0]}"`;
}

// ───────────── Recent-texts memory ─────────────

export type VariantGroup = "standard" | "casual" | "nospam";

export async function fetchRecentTexts(
  siteId: string | null,
  smsType: string,
  variantGroup: VariantGroup,
  limit = 15,
): Promise<string[]> {
  try {
    let query = supabaseAdmin
      .from("recent_sms_outputs")
      .select("text")
      .eq("sms_type", smsType)
      .eq("variant", variantGroup)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (siteId) {
      query = query.eq("site_id", siteId);
    } else {
      query = query.is("site_id", null);
    }
    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((r) => String(r.text)).filter(Boolean);
  } catch {
    return [];
  }
}

export async function saveRecentTexts(
  siteId: string | null,
  smsType: string,
  variantGroup: VariantGroup,
  texts: string[],
): Promise<void> {
  const rows = texts
    .filter((t) => typeof t === "string" && t.trim().length > 0)
    .map((t) => ({
      site_id: siteId,
      sms_type: smsType,
      variant: variantGroup,
      text: t.trim(),
    }));
  if (rows.length === 0) return;
  try {
    await supabaseAdmin.from("recent_sms_outputs").insert(rows);
    // Lazy cleanup: keep only the most recent 50 rows per (site,type,variant).
    const { data: keepers } = await supabaseAdmin
      .from("recent_sms_outputs")
      .select("id")
      .eq("sms_type", smsType)
      .eq("variant", variantGroup)
      .order("created_at", { ascending: false })
      .limit(50);
    if (keepers && keepers.length === 50) {
      const keepIds = keepers.map((k) => k.id);
      let del = supabaseAdmin
        .from("recent_sms_outputs")
        .delete()
        .eq("sms_type", smsType)
        .eq("variant", variantGroup)
        .not("id", "in", `(${keepIds.map((id) => `"${id}"`).join(",")})`);
      if (siteId) {
        del = del.eq("site_id", siteId);
      } else {
        del = del.is("site_id", null);
      }
      await del;
    }
  } catch {
    // best-effort; never block the response
  }
}

export function renderRecentTextsBlock(label: string, texts: string[]): string {
  if (texts.length === 0) return "";
  const numbered = texts.map((t, i) => `  ${i + 1}. ${t}`).join("\n");
  return `RECENT ${label} SENDS — DO NOT mirror these openers, phrasings, sentence shapes, emoji choices, or word picks. Make every new variant feel distinctly different from these:
${numbered}`;
}
