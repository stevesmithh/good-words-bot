export type SpamCategoryId =
  | "financial"
  | "urgency"
  | "hype"
  | "promises"
  | "sales"
  | "scam"
  | "formatting";

export const SPAM_CATEGORIES: { id: SpamCategoryId; label: string; words: string[] }[] = [
  {
    id: "financial",
    label: "Financial & money",
    words: [
      "money", "cash", "profit", "dollar", "$$$", "income", "earnings", "payday", "revenue",
      "returns", "dividend", "wealth", "rich", "millionaire", "billionaire", "money-making",
      "cash back", "cash bonus", "cash advance", "quick cash", "fast cash", "easy money",
      "extra income", "double your income", "triple your income", "make money", "earn cash",
      "earn money", "passive income", "investment", "invest", "payout", "grant",
      "financial independence", "financial freedom", "jackpot", "windfall", "bet", "betting",
      "wager", "cheap", "discount", "bargain", "slash prices", "no credit check", "cheap loan",
      "be your own boss", "financial gain", "get paid", "instant cash", "earn", "credit",
    ],
  },
  {
    id: "urgency",
    label: "Urgency & pressure",
    words: [
      "act now", "limited time", "hurry", "urgent", "immediate", "rush", "last chance",
      "today only", "expires", "offer ends", "final", "don't miss out", "before it's too late",
      "instant access", "don't wait", "deadline", "closing soon", "while supplies last",
      "time-sensitive", "minutes remaining", "seconds left", "last minute", "expiring",
      "countdown", "only a few left", "running out", "act fast", "must end soon", "ending soon",
      "don't delay", "save now", "immediate action", "fast action bonus", "quick fix",
      "quick gains", "must act", "must buy", "must see", "must have", "offer expires",
      "hurry now", "flash sale", "limited spots", "now only",
    ],
  },
  {
    id: "hype",
    label: "Marketing hype",
    words: [
      "amazing", "incredible", "miracle", "sensational", "remarkable", "fantastic",
      "tremendous", "phenomenal", "extraordinary", "unbelievable", "revolutionary",
      "innovative", "breakthrough", "state-of-the-art", "cutting-edge", "next generation",
      "groundbreaking", "world-class", "award-winning", "record-breaking", "maximize",
      "optimize", "transform", "unlock", "unleash", "skyrocket", "explode", "dominate",
      "mind-blowing", "jaw-dropping", "eye-popping", "electrifying", "breathtaking",
      "awe-inspiring", "life-changing", "once in a lifetime", "never before seen",
      "game-changer", "trailblazing", "pioneering",
    ],
  },
  {
    id: "promises",
    label: "Exaggerated promises",
    words: [
      "guaranteed", "risk-free", "promise", "proven", "no obligation", "no risk", "no hidden",
      "foolproof", "never fail", "flawless", "100% guaranteed", "satisfaction guaranteed",
      "miracle cure", "no hassle", "no worries", "no stress", "no problem", "painless",
      "all-inclusive", "lifetime", "results", "tested", "reliable", "unmatched", "superior",
      "leading", "unbeatable", "optimal", "perfect", "ultimate", "risk free",
      "money-back guarantee", "no hidden fees", "amazing results",
    ],
  },
  {
    id: "sales",
    label: "Aggressive sales",
    words: [
      "buy now", "special deal", "best price", "limited offer", "exclusive access",
      "special promotion", "unique offer", "premium", "elite", "unlimited", "complete",
      "unconditional", "certified", "effective", "efficient", "powerful", "real results",
      "genuine", "authentic", "shop now", "order now", "purchase now", "special offer",
      "don't miss", "exclusive offer", "best deal", "one time offer", "one-day sale",
      "flash sale", "save big",
    ],
  },
  {
    id: "scam",
    label: "Scam & generic",
    words: [
      "dear friend", "congratulations", "you've been selected", "claim your prize",
      "you have won", "lottery winner", "click here", "download now", "apply here",
      "claim your offer", "redeem now", "access now", "activate now", "get yours",
      "this is not spam", "you are a winner", "selected for you", "dear homeowner",
      "valued customer", "current resident", "dear sir", "to whom it may concern",
      "official message", "you've won", "hidden", "secret", "confidential", "insider",
      "underground", "offshore", "questionable", "dubious", "shady", "fraudulent", "scam",
      "fake", "deceptive", "misleading",
    ],
  },
  {
    id: "formatting",
    label: "Formatting triggers",
    words: ["!!!", "$$$", "FREE!!!", "URGENT", "ACT NOW", "CLICK HERE", "ALL CAPS"],
  },
];

export const SAFE_REPLACEMENTS: Record<string, string> = {
  free: "complimentary",
  guaranteed: "we stand behind",
  amazing: "solid",
  incredible: "real",
  exclusive: "available to you",
  "limited time": "through [date]",
  "act now": "when you are ready",
  "buy now": "get started",
  "don't miss out": "worth a look",
  "last chance": "available until [date]",
  "save big": "save",
  "best price": "competitive pricing",
  urgent: "a note",
  hurry: "when you are ready",
  jackpot: "top reward",
  win: "earn",
  cash: "funds",
  bonus: "extra",
  deal: "offer",
  discount: "reduced price",
  cheap: "cost-effective",
};
