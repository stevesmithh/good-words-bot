export type SmsSpamCategoryId =
  | "financial"
  | "crypto"
  | "work"
  | "prizes"
  | "discounts"
  | "generic"
  | "geography"
  | "formatting";

export const SMS_SPAM_CATEGORIES: {
  id: SmsSpamCategoryId;
  label: string;
  words: string[];
}[] = [
  {
    id: "financial",
    label: "Financial & payments",
    words: [
      "payment", "withdraw", "withdrawal", "usd", "cash", "payslip", "debit card",
      "credit card", "chase", "bank", "wire", "wire transfer", "deposit", "payout",
      "ach", "zelle", "venmo", "paypal", "account", "credit", "loan", "refund", "tax",
      "irs", "ssn", "social security", "stimulus", "check", "cashapp", "money order",
    ],
  },
  {
    id: "crypto",
    label: "Crypto",
    words: [
      "coin", "coinbase", "btc", "bitcoin", "eth", "ethereum", "crypto", "wallet",
      "blockchain", "nft", "token", "binance", "kraken", "defi", "mining", "airdrop",
    ],
  },
  {
    id: "work",
    label: "Work & income",
    words: [
      "job", "remote", "remote job", "hiring", "work from home", "side hustle", "earn",
      "salary", "payslip", "profitable", "base", "make money", "extra income",
      "passive income", "career", "vacancy", "position",
    ],
  },
  {
    id: "prizes",
    label: "Prizes & gambling",
    words: [
      "sweepstakes", "lottery", "jackpot", "winner", "prize", "casino", "bet", "betting",
      "wager", "raffle", "drawing", "you won", "you've won", "selected", "congratulations",
    ],
  },
  {
    id: "discounts",
    label: "Discounts & urgency",
    words: [
      "reduction", "discount", "% off", "sale", "limited time", "expires", "act now",
      "hurry", "last chance", "today only", "ends today", "offer ends", "flash sale",
      "blowout", "clearance", "lowest price", "best price", "save big",
    ],
  },
  {
    id: "generic",
    label: "Generic spam triggers",
    words: [
      "click here", "click link", "click below", "free", "congratulations", "claim",
      "verify", "suspended", "locked", "alert", "urgent", "warning", "confirm",
      "validate", "reactivate", "unsubscribe", "stop2end", "msg & data rates",
      "txt stop", "this is not spam", "dear customer", "dear friend",
    ],
  },
  {
    id: "geography",
    label: "Geography flags",
    words: ["usa", "us-only", "united states", "u.s.a.", "u.s.", "americans only"],
  },
  {
    id: "formatting",
    label: "Formatting triggers",
    words: ["!!!", "$$$", "???", "ALL CAPS", "FREE!!!", "URGENT", "ACT NOW"],
  },
];

export const SMS_SAFE_REPLACEMENTS: Record<string, string> = {
  free: "complimentary",
  cash: "funds",
  win: "earn",
  winner: "selected",
  bonus: "extra",
  deposit: "top-up",
  withdraw: "cash out",
  payment: "transfer",
  discount: "reduced price",
  "click here": "tap to view",
  "click link": "tap link",
  hurry: "when ready",
  "act now": "when ready",
  urgent: "quick note",
  jackpot: "top reward",
  account: "profile",
};
