import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2, MessageSquare, Sparkles, AlertCircle, Check, Link2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  SMS_SPAM_CATEGORIES,
  type SmsSpamCategoryId,
} from "@/lib/sms-spam-words";
import { useCatalog } from "@/lib/catalog";
import { logGeneration } from "@/lib/usage";

type SiteId = string;
type SmsProvider = string;
type Promotion = {
  id: string;
  site_id: string;
  name: string;
  destination_url: string;
  short_domain_override: string | null;
};

type Audience = "new" | "active" | "inactive";
type SmsType = "promotional" | "deposit_coupon" | "deposit_bonus" | "signup_promo";
type LengthTarget = "short" | "standard";
type DepositOrdinal = "1st" | "2nd" | "3rd";

type SmsResult = {
  message: string;
  standardA: string;
  standardB: string;
  casualA: string;
  casualB: string;
  casualC: string;
  nospamA?: string;
  nospamB?: string;
  nospamC?: string;
};

type ShortLinkInfo = {
  linkId: string;
  shortUrl: string;
  isReused: boolean;
  used: boolean;
};

const SMS_TYPES: { id: SmsType; label: string; desc: string }[] = [
  { id: "promotional", label: "Promotional", desc: "No code" },
  { id: "deposit_coupon", label: "Deposit coupon", desc: "Code for deposit bonus" },
  { id: "deposit_bonus", label: "Deposit bonus", desc: "1st / 2nd / 3rd" },
  { id: "signup_promo", label: "Signup promo", desc: "Code for signup" },
];


function segmentInfo(text: string) {
  const len = text.length;
  let segments = 1;
  if (len > 160 && len <= 306) segments = 2;
  else if (len > 306 && len <= 459) segments = 3;
  else if (len > 459) segments = Math.ceil(len / 153);
  let color: "green" | "amber" | "red" = "green";
  if (len > 306) color = "red";
  else if (len > 160) color = "amber";
  return { len, segments, color };
}

export function SmsGenerator() {
  const [smsType, setSmsType] = useState<SmsType>("promotional");
  const [offerDetails, setOfferDetails] = useState("");
  const [audience, setAudience] = useState<Audience>("active");
  const [brandName, setBrandName] = useState("");
  const [lengthTarget, setLengthTarget] = useState<LengthTarget>("short");
  const [extraForbidden, setExtraForbidden] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<SmsSpamCategoryId>>(
    () => new Set(SMS_SPAM_CATEGORIES.map((c) => c.id)),
  );

  // Site / promotion / provider — driven by DB-backed catalog
  const { data: catalog } = useCatalog();
  const SITES = catalog?.sites ?? [];
  const PROMOTIONS = catalog?.promotions ?? [];
  const SMS_PROVIDERS = catalog?.providers ?? [];

  const [siteId, setSiteId] = useState<SiteId>("");
  const [promotionId, setPromotionId] = useState<string>("");
  const [provider, setProvider] = useState<SmsProvider>("");

  // Conditional fields
  const [couponCode, setCouponCode] = useState("");
  const [bonusDescription, setBonusDescription] = useState("");
  const [depositOrdinal, setDepositOrdinal] = useState<DepositOrdinal>("1st");
  const [bonusAmount, setBonusAmount] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [freePlayReward, setFreePlayReward] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SmsResult | null>(null);
  const [shortLink, setShortLink] = useState<ShortLinkInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);

  // Initialize defaults once catalog loads
  useEffect(() => {
    if (!siteId && SITES.length > 0) setSiteId(SITES[0].id);
    if (!provider && SMS_PROVIDERS.length > 0) setProvider(SMS_PROVIDERS[0].name);
  }, [SITES, SMS_PROVIDERS, siteId, provider]);

  const sitePromotions = useMemo(
    () => PROMOTIONS.filter((p) => p.site_id === siteId),
    [PROMOTIONS, siteId],
  );

  // Auto-fill brand from site, and reset promotion when site changes
  useEffect(() => {
    if (siteId) setBrandName(siteId);
    if (!sitePromotions.find((p) => p.id === promotionId)) {
      setPromotionId(sitePromotions[0]?.id ?? "");
    }
  }, [siteId, sitePromotions, promotionId]);

  const selectedPromotion: Promotion | undefined = useMemo(
    () => PROMOTIONS.find((p) => p.id === promotionId),
    [PROMOTIONS, promotionId],
  );

  const toggleCategory = (id: SmsSpamCategoryId) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!offerDetails.trim()) e.offer = "Required.";
    if (!promotionId) e.promotion = "Pick a promotion.";
    if (smsType === "deposit_coupon" && !couponCode.trim()) e.coupon = "Required.";
    if (smsType === "signup_promo" && !promoCode.trim()) e.promo = "Required.";
    if (smsType === "deposit_bonus" && !bonusAmount.trim()) e.bonus = "Required.";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleGenerate = async () => {
    if (!validate()) return;
    setErrorMsg(null);
    setRawError(null);
    setLoading(true);
    setResult(null);
    setShortLink(null);

    try {
      // 1. Get or create the short link first
      const linkResp = await fetch("/api/shortio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get-or-create",
          promotionId,
          provider,
        }),
      });
      const linkData = await linkResp.json().catch(() => ({}));
      if (!linkResp.ok) {
        const msg = (linkData?.error as string) || `Short link error ${linkResp.status}`;
        setErrorMsg(`Short link error: ${msg}`);
        toast.error(msg);
        return;
      }

      const link: ShortLinkInfo = {
        linkId: linkData.linkId,
        shortUrl: linkData.shortUrl,
        isReused: !!linkData.isReused,
        used: false,
      };
      setShortLink(link);

      // 2. Generate the SMS using that short link as the CTA
      const payload: Record<string, unknown> = {
        smsType,
        offerDetails,
        audience,
        brandName: brandName.trim() || undefined,
        ctaLink: link.shortUrl,
        lengthTarget,
        extraForbidden: extraForbidden.trim() || undefined,
        activeCategories: Array.from(activeCategories),
        siteId: siteId || undefined,
      };

      if (smsType === "deposit_coupon") {
        payload.couponCode = couponCode.trim();
        payload.bonusDescription = bonusDescription.trim() || undefined;
      }
      if (smsType === "deposit_bonus") {
        payload.depositOrdinal = depositOrdinal;
        payload.bonusAmount = bonusAmount.trim();
        if (couponCode.trim()) payload.couponCode = couponCode.trim();
      }
      if (smsType === "signup_promo") {
        payload.promoCode = promoCode.trim();
        payload.freePlayReward = freePlayReward.trim() || undefined;
      }

      const resp = await fetch("/api/generate-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        const msg = (data?.error as string) || `Request failed with status ${resp.status}`;
        setErrorMsg(`API error: ${resp.status} — ${msg}`);
        if (data?.raw) setRawError(String(data.raw));
        toast.error(msg);
        return;
      }

      setResult(data as SmsResult);
      toast.success(link.isReused ? "SMS generated (reused link)" : "SMS generated (new link)");
      void logGeneration("sms");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkUsed = async () => {
    if (!shortLink || shortLink.used) return;
    try {
      const resp = await fetch("/api/shortio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-used", linkId: shortLink.linkId }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        toast.error((data?.error as string) || "Failed to mark used");
        return;
      }
      setShortLink({ ...shortLink, used: true });
      toast.success("Marked as used — next generation will create a new link");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(message);
    }
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const allVariants = useMemo(() => {
    if (!result) return "";
    const parts = [
      `Standard — Primary:\n${result.message}`,
      `Standard A:\n${result.standardA}`,
      `Standard B:\n${result.standardB}`,
      `Casual A:\n${result.casualA}`,
      `Casual B:\n${result.casualB}`,
      `Casual C:\n${result.casualC}`,
    ];
    if (result.nospamA) parts.push(`No-Spam A:\n${result.nospamA}`);
    if (result.nospamB) parts.push(`No-Spam B:\n${result.nospamB}`);
    if (result.nospamC) parts.push(`No-Spam C:\n${result.nospamC}`);
    return parts.join("\n\n");
  }, [result]);


  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>SMS details</CardTitle>
          <CardDescription>
            Pick a site + promotion. The short link is generated and tracked automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Site + Promotion + Provider */}
          <div className="space-y-4 rounded-md border bg-muted/30 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="site">
                  Site <span className="text-destructive">*</span>
                </Label>
                <Select value={siteId} onValueChange={(v) => setSiteId(v as SiteId)}>
                  <SelectTrigger id="site">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SITES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider">
                  SMS provider <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={provider}
                  onValueChange={(v) => setProvider(v as SmsProvider)}
                >
                  <SelectTrigger id="provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SMS_PROVIDERS.map((p) => (
                      <SelectItem key={p.id} value={p.name}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="promotion">
                Promotion <span className="text-destructive">*</span>
              </Label>
              <Select
                value={promotionId}
                onValueChange={(v) => {
                  setPromotionId(v);
                  if (errors.promotion) setErrors({ ...errors, promotion: "" });
                }}
              >
                <SelectTrigger id="promotion" aria-invalid={!!errors.promotion}>
                  <SelectValue placeholder="Pick a promotion" />
                </SelectTrigger>
                <SelectContent className="max-h-[320px]">
                  {sitePromotions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.promotion && (
                <p className="text-xs text-destructive">{errors.promotion}</p>
              )}
              {selectedPromotion && (
                <p className="truncate text-xs text-muted-foreground">
                  → {selectedPromotion.destination_url}
                </p>
              )}
            </div>
          </div>

          {/* SMS type segmented buttons */}
          <div className="space-y-2">
            <Label>SMS type</Label>
            <div className="grid grid-cols-2 gap-2">
              {SMS_TYPES.map((t) => {
                const on = smsType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSmsType(t.id)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left transition-colors",
                      on
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:border-foreground/30",
                    )}
                    aria-pressed={on}
                  >
                    <div className="text-sm font-medium">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conditional fields */}
          {smsType === "deposit_coupon" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="coupon">
                  Coupon code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="coupon"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="WELCOME50"
                  aria-invalid={!!errors.coupon}
                />
                {errors.coupon && <p className="text-xs text-destructive">{errors.coupon}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="bonusDesc">Bonus description</Label>
                <Input
                  id="bonusDesc"
                  value={bonusDescription}
                  onChange={(e) => setBonusDescription(e.target.value)}
                  placeholder="100% up to $200"
                />
              </div>
            </div>
          )}

          {smsType === "deposit_bonus" && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ordinal">Deposit</Label>
                  <Select
                    value={depositOrdinal}
                    onValueChange={(v) => setDepositOrdinal(v as DepositOrdinal)}
                  >
                    <SelectTrigger id="ordinal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1st">1st deposit</SelectItem>
                      <SelectItem value="2nd">2nd deposit</SelectItem>
                      <SelectItem value="3rd">3rd deposit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bonusAmt">
                    Bonus amount or % <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="bonusAmt"
                    value={bonusAmount}
                    onChange={(e) => setBonusAmount(e.target.value)}
                    placeholder="100% up to $300"
                    aria-invalid={!!errors.bonus}
                  />
                  {errors.bonus && <p className="text-xs text-destructive">{errors.bonus}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="couponOpt">Coupon code (optional)</Label>
                <Input
                  id="couponOpt"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="DEPOSIT300"
                />
              </div>
            </div>
          )}

          {smsType === "signup_promo" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="promo">
                  Promo code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="promo"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="JOIN25"
                  aria-invalid={!!errors.promo}
                />
                {errors.promo && <p className="text-xs text-destructive">{errors.promo}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reward">Signup reward</Label>
                <Input
                  id="reward"
                  value={freePlayReward}
                  onChange={(e) => setFreePlayReward(e.target.value)}
                  placeholder="$10 free play"
                />
              </div>
            </div>
          )}


          <div className="space-y-2">
            <Label htmlFor="smsOffer">
              Offer details <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="smsOffer"
              value={offerDetails}
              onChange={(e) => {
                setOfferDetails(e.target.value);
                if (errors.offer) setErrors({ ...errors, offer: "" });
              }}
              placeholder="What you are giving and any context"
              className="min-h-[80px]"
              aria-invalid={!!errors.offer}
            />
            {errors.offer && <p className="text-xs text-destructive">{errors.offer}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smsAud">Audience</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
                <SelectTrigger id="smsAud">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New users</SelectItem>
                  <SelectItem value="active">Active users</SelectItem>
                  <SelectItem value="inactive">Inactive users</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="smsBrand">Brand name</Label>
              <Input
                id="smsBrand"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Auto-filled from site"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Length target</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["short", "standard"] as LengthTarget[]).map((opt) => {
                const on = lengthTarget === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setLengthTarget(opt)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left text-xs transition-colors",
                      on
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:border-foreground/30",
                    )}
                  >
                    <div className="font-medium">
                      {opt === "short" ? "Short" : "Standard"}
                    </div>
                    <div className="text-muted-foreground">
                      {opt === "short" ? "Under 160 chars (1 segment)" : "10–15 words + link"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="smsExtra">Extra forbidden words (optional)</Label>
            <Input
              id="smsExtra"
              value={extraForbidden}
              onChange={(e) => setExtraForbidden(e.target.value)}
              placeholder="comma, separated, words"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Spam categories to filter</Label>
              <span className="text-xs text-muted-foreground">
                {activeCategories.size} of {SMS_SPAM_CATEGORIES.length} on
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SMS_SPAM_CATEGORIES.map((cat) => {
                const on = activeCategories.has(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                    )}
                    aria-pressed={on}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={loading} className="w-full" size="lg">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate SMS
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Output */}
      <div className="space-y-4">
        {errorMsg && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-start gap-2 text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-sm font-medium">{errorMsg}</p>
              </div>
              {rawError && (
                <Collapsible>
                  <CollapsibleTrigger className="text-xs text-muted-foreground underline underline-offset-2">
                    Show raw response
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <pre className="mt-2 max-h-60 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap break-words">
                      {rawError}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </CardContent>
          </Card>
        )}

        {loading && !result && <SmsLoadingSkeleton />}

        {!loading && !result && !errorMsg && <SmsEmptyState />}

        {result && shortLink && (
          <>
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex flex-wrap items-center gap-3 py-3">
                <Link2 className="h-4 w-4 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Short link {shortLink.isReused ? "(reused — not yet used)" : "(fresh)"}
                  </p>
                  <p className="truncate text-sm font-mono">{shortLink.shortUrl}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copy(shortLink.shortUrl, "Short link")}
                  className="h-8 px-2"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>

            <div className="flex items-center gap-2 pt-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Standard
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <SmsCard
              title="Primary"
              value={result.message}
              shortLink={shortLink}
              onCopy={() => copy(result.message, "Primary")}
              onMarkUsed={handleMarkUsed}
            />
            <SmsCard
              title="Standard A"
              value={result.standardA}
              shortLink={shortLink}
              onCopy={() => copy(result.standardA, "Standard A")}
              onMarkUsed={handleMarkUsed}
            />
            <SmsCard
              title="Standard B"
              value={result.standardB}
              shortLink={shortLink}
              onCopy={() => copy(result.standardB, "Standard B")}
              onMarkUsed={handleMarkUsed}
            />

            <div className="flex items-center gap-2 pt-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Casual / daily-text
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <SmsCard
              title="Casual A"
              value={result.casualA}
              shortLink={shortLink}
              onCopy={() => copy(result.casualA, "Casual A")}
              onMarkUsed={handleMarkUsed}
            />
            <SmsCard
              title="Casual B"
              value={result.casualB}
              shortLink={shortLink}
              onCopy={() => copy(result.casualB, "Casual B")}
              onMarkUsed={handleMarkUsed}
            />
            <SmsCard
              title="Casual C"
              value={result.casualC}
              shortLink={shortLink}
              onCopy={() => copy(result.casualC, "Casual C")}
              onMarkUsed={handleMarkUsed}
            />




            {(result.nospamA || result.nospamB || result.nospamC) && (
              <>
                <div className="flex items-center gap-2 pt-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    No-Spam
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                {result.nospamA && (
                  <SmsCard
                    title="No-Spam A"
                    value={result.nospamA}
                    shortLink={shortLink}
                    onCopy={() => copy(result.nospamA!, "No-Spam A")}
                    onMarkUsed={handleMarkUsed}
                  />
                )}
                {result.nospamB && (
                  <SmsCard
                    title="No-Spam B"
                    value={result.nospamB}
                    shortLink={shortLink}
                    onCopy={() => copy(result.nospamB!, "No-Spam B")}
                    onMarkUsed={handleMarkUsed}
                  />
                )}
                {result.nospamC && (
                  <SmsCard
                    title="No-Spam C"
                    value={result.nospamC}
                    shortLink={shortLink}
                    onCopy={() => copy(result.nospamC!, "No-Spam C")}
                    onMarkUsed={handleMarkUsed}
                  />
                )}
              </>
            )}



            <Button
              variant="secondary"
              className="w-full"
              onClick={() => copy(allVariants, "All variants")}
            >
              <Copy className="h-4 w-4" />
              Copy all variants
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function SmsCard({
  title,
  value,
  shortLink,
  onCopy,
  onMarkUsed,
}: {
  title: string;
  value: string;
  shortLink: ShortLinkInfo;
  onCopy: () => void;
  onMarkUsed: () => void;
}) {
  const { len, segments, color } = segmentInfo(value);
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          <p
            className={cn(
              "text-xs font-medium",
              color === "green" && "text-success",
              color === "amber" && "text-warning",
              color === "red" && "text-destructive",
            )}
          >
            {len} chars · {segments} segment{segments > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={shortLink.used ? "default" : "outline"}
            size="sm"
            onClick={onMarkUsed}
            disabled={shortLink.used}
            className={cn(
              "h-8 px-2",
              shortLink.used && "bg-success text-white hover:bg-success",
            )}
            title={
              shortLink.used
                ? "Marked as used — next generation will create a new link"
                : "Mark this as the variant you sent"
            }
          >
            <Check className="h-3.5 w-3.5" />
            {shortLink.used ? "Used" : "I sent this"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onCopy} className="h-8 px-2">
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function SmsLoadingSkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </CardContent>
        </Card>
      ))}
    </>
  );
}

function SmsEmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Your SMS will appear here</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Pick the site, promotion and SMS provider, then click generate.
        </p>
      </CardContent>
    </Card>
  );
}
