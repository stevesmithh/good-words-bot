import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LinkPreviewButton } from "@/components/LinkPreview";
import {
  AlertCircle,
  Copy,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Sparkles,
  Share2,
  Lightbulb,
  Link2,
  ChevronDown,
  AlertTriangle,
  XCircle,
} from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import {
  PLATFORM_POLICIES,
  SOCIAL_PLATFORMS,
  SOCIAL_TONES,
  scanInputForHardBlocks,
  type RiskLevel,
  type SocialPlatform,
  type SocialTone,
  type AuditEntry,
} from "@/lib/social-compliance";
import { useCatalog } from "@/lib/catalog";
import { logGeneration, logHistory } from "@/lib/usage";
import { authFields } from "@/lib/session";

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

type LinkMode = "ready" | "manual";

const DEFAULT_PLATFORMS = new Set<SocialPlatform>(
  SOCIAL_PLATFORMS.map((p) => p.id),
);

export function SocialGenerator() {
  const { data: catalog } = useCatalog();
  const SITES = catalog?.sites ?? [];
  const PROMOTIONS = catalog?.promotions ?? [];

  const [siteId, setSiteId] = useState("");
  const [linkMode, setLinkMode] = useState<LinkMode>("ready");
  const [promotionId, setPromotionId] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualLabel, setManualLabel] = useState("");
  const [geo, setGeo] = useState("");
  const [tone, setTone] = useState<SocialTone>("promotional");
  const [coreIdea, setCoreIdea] = useState("");
  const [offerName, setOfferName] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [gameTitles, setGameTitles] = useState("");
  const [isUsIgaming, setIsUsIgaming] = useState(true);
  const [platforms, setPlatforms] = useState<Set<SocialPlatform>>(
    () => new Set(DEFAULT_PLATFORMS),
  );

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [results, setResults] = useState<PlatformOut[] | null>(null);
  const [usedShortUrl, setUsedShortUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId && SITES.length > 0) setSiteId(SITES[0].id);
  }, [SITES, siteId]);

  const sitePromotions = useMemo(
    () => PROMOTIONS.filter((p) => p.site_id === siteId),
    [PROMOTIONS, siteId],
  );

  useEffect(() => {
    if (!sitePromotions.find((p) => p.id === promotionId)) {
      setPromotionId(sitePromotions[0]?.id ?? "");
    }
  }, [sitePromotions, promotionId]);

  const selectedPromotion = useMemo(
    () => PROMOTIONS.find((p) => p.id === promotionId),
    [PROMOTIONS, promotionId],
  );

  const togglePlatform = (p: SocialPlatform) => {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) {
        if (next.size > 1) next.delete(p);
      } else {
        next.add(p);
      }
      return next;
    });
  };

  // Input pre-screen (Issue 4 Layer 1) — scan brief + structured facts.
  const inputHits = useMemo(() => {
    const blob = [coreIdea, offerName, offerAmount, promoCode, gameTitles].join(" \n ");
    return scanInputForHardBlocks(blob);
  }, [coreIdea, offerName, offerAmount, promoCode, gameTitles]);

  const linkReady =
    linkMode === "ready"
      ? !!promotionId
      : !!siteId && !!manualUrl.trim() && !!manualLabel.trim();
  const canGenerate =
    linkReady && coreIdea.trim().length >= 5 && inputHits.length === 0 && !loading;

  const handleGenerate = async () => {
    setErrorMsg(null);
    setResults(null);
    setUsedShortUrl(null);
    setLoading(true);
    try {
      const shortBody =
        linkMode === "ready"
          ? { ...authFields(), action: "ready" as const, promotionId }
          : {
              ...authFields(),
              action: "manual" as const,
              siteId,
              destinationUrl: manualUrl.trim(),
              label: manualLabel.trim(),
            };
      const shortResp = await fetch("/api/social-shortlink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shortBody),
      });
      const shortData = await shortResp.json().catch(() => ({}));
      if (!shortResp.ok) {
        const msg = (shortData?.error as string) || `Short link failed (${shortResp.status})`;
        setErrorMsg(msg);
        toast.error(msg);
        return;
      }
      const shortUrl = shortData.shortUrl as string;
      setUsedShortUrl(shortUrl);

      const promotionName =
        linkMode === "ready" ? selectedPromotion?.name : manualLabel.trim();

      const payload = {
        ...authFields(),
        siteId: siteId || undefined,
        brandName: siteId || undefined,
        promotionName,
        promotionUrl: shortUrl,
        topic: coreIdea.trim(),
        geo: geo.trim() || undefined,
        isUsIgaming,
        tone,
        platforms: Array.from(platforms),
        facts: {
          offerName: offerName.trim() || undefined,
          offerAmount: offerAmount.trim() || undefined,
          promoCode: promoCode.trim() || undefined,
          gameTitles: gameTitles.trim() || undefined,
        },
      };

      const resp = await fetch("/api/generate-social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg = (data?.error as string) || `Request failed (${resp.status})`;
        setErrorMsg(msg);
        toast.error(msg);
        return;
      }
      setResults((data.platforms ?? []) as PlatformOut[]);
      toast.success("Social posts generated");
      void logGeneration("sms");
      void logHistory({
        kind: "social",
        label: coreIdea.slice(0, 80) || promotionName || null,
        input: payload,
        output: data,
      });
    } catch (err) {
      const m = err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(m);
      toast.error(m);
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Social post details</CardTitle>
          <CardDescription>
            Compliance-safe copy for iGaming brands. Built to pass Meta, TikTok, X, and Telegram review.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-4 rounded-md border bg-muted/30 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="s-site">Site / brand *</Label>
                <Select value={siteId} onValueChange={setSiteId}>
                  <SelectTrigger id="s-site"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SITES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-tone">Tone</Label>
                <Select value={tone} onValueChange={(v) => setTone(v as SocialTone)}>
                  <SelectTrigger id="s-tone"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOCIAL_TONES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex flex-col">
                          <span>{t.label}</span>
                          <span className="text-xs text-muted-foreground">{t.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Link source</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLinkMode("ready")}
                  className={cn(
                    "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    linkMode === "ready"
                      ? "border-primary bg-primary/5 font-medium"
                      : "border-border bg-background text-muted-foreground hover:border-foreground/30",
                  )}
                  aria-pressed={linkMode === "ready"}
                >
                  Ready promotion
                </button>
                <button
                  type="button"
                  onClick={() => setLinkMode("manual")}
                  className={cn(
                    "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    linkMode === "manual"
                      ? "border-primary bg-primary/5 font-medium"
                      : "border-border bg-background text-muted-foreground hover:border-foreground/30",
                  )}
                  aria-pressed={linkMode === "manual"}
                >
                  Manual link
                </button>
              </div>
            </div>

            {linkMode === "ready" ? (
              <div className="space-y-2">
                <Label htmlFor="s-promo">Promotion *</Label>
                <Select value={promotionId} onValueChange={setPromotionId}>
                  <SelectTrigger id="s-promo"><SelectValue placeholder="Pick a promotion" /></SelectTrigger>
                  <SelectContent className="max-h-[320px]">
                    {sitePromotions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPromotion && (
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">→ {selectedPromotion.destination_url}</p>
                    <LinkPreviewButton url={selectedPromotion.destination_url} />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="s-manual-label">Link label *</Label>
                  <Input
                    id="s-manual-label"
                    value={manualLabel}
                    onChange={(e) => setManualLabel(e.target.value)}
                    placeholder="e.g. Weekend tournament landing page"
                    maxLength={200}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-manual-url">Destination URL *</Label>
                  <Input
                    id="s-manual-url"
                    type="url"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    placeholder="https://example.com/landing"
                  />
                  <p className="text-xs text-muted-foreground">
                    A short link will be auto-created on the selected site's domain and tagged <code className="font-mono">sm</code>.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Core idea — required */}
          <div className="space-y-2">
            <Label htmlFor="s-idea">What are you promoting? Core idea & angle *</Label>
            <Textarea
              id="s-idea"
              value={coreIdea}
              onChange={(e) => setCoreIdea(e.target.value)}
              placeholder="One or two sentences. What's the offer? Who's it for? What's the hook?"
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">
              This is the brief — every variant will be built around it.
            </p>
          </div>

          {/* Structured facts (Issue 5 — anti-fabrication) */}
          <div className="space-y-3 rounded-md border border-dashed bg-muted/20 p-3">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Brief facts (optional but recommended)</p>
                <p className="text-xs text-muted-foreground">
                  Only details entered here may appear verbatim in the copy. Leave blank to keep the AI generic.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="f-name" className="text-xs">Offer name</Label>
                <Input id="f-name" value={offerName} onChange={(e) => setOfferName(e.target.value)} placeholder="e.g. Summer Drop" maxLength={200} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-amount" className="text-xs">Offer amount</Label>
                <Input id="f-amount" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} placeholder="e.g. $20 credit · 100 spins" maxLength={80} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-code" className="text-xs">Promo code</Label>
                <Input id="f-code" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="e.g. WELCOME50 (leave blank if none)" maxLength={80} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-games" className="text-xs">Game titles</Label>
                <Input id="f-games" value={gameTitles} onChange={(e) => setGameTitles(e.target.value)} placeholder="e.g. Lucky Wilds, Reel Rush" maxLength={300} />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="s-geo">Target GEO</Label>
              <Input
                id="s-geo"
                value={geo}
                onChange={(e) => setGeo(e.target.value)}
                placeholder="e.g. US – NJ, PA, MI"
              />
              <p className="text-xs text-muted-foreground">
                Internal targeting only. Will NOT appear in caption body (eligibility lives in the disclaimer).
              </p>
            </div>
            <div className="space-y-2">
              <Label>Audience flag</Label>
              <label className="flex items-start gap-2 rounded-md border bg-background p-2.5 text-sm">
                <Checkbox
                  checked={isUsIgaming}
                  onCheckedChange={(v) => setIsUsIgaming(v === true)}
                />
                <span>
                  <span className="font-medium">US iGaming</span>
                  <span className="block text-xs text-muted-foreground">
                    Applies stricter compliance review.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Platforms (at least one)</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SOCIAL_PLATFORMS.map((p) => {
                const on = platforms.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlatform(p.id)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                      on
                        ? "border-primary bg-primary/5 font-medium"
                        : "border-border bg-background text-muted-foreground hover:border-foreground/30",
                    )}
                    aria-pressed={on}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input hard-block banner */}
          {inputHits.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <div className="flex items-start gap-2 text-destructive">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-2">
                  <p className="font-medium">
                    Brief contains blocked phrase{inputHits.length > 1 ? "s" : ""}. Generation disabled until removed.
                  </p>
                  <ul className="space-y-1">
                    {inputHits.map((h) => (
                      <li key={h.term} className="text-xs">
                        <span className="rounded bg-destructive/20 px-1.5 py-0.5 font-mono">{h.term}</span>
                        <span className="mx-1 text-muted-foreground">→ try</span>
                        <span className="rounded bg-success/20 px-1.5 py-0.5 font-mono text-success-foreground">{h.safer}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Generate posts</>
            )}
          </Button>

          <Accordion type="single" collapsible>
            <AccordionItem value="tips" className="border-0">
              <AccordionTrigger className="rounded-md bg-muted/40 px-3 py-2 text-sm hover:no-underline">
                <span className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  Tips for higher-converting safe posts
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pt-3 text-sm text-muted-foreground">
                <ul className="list-disc space-y-1.5 pl-4">
                  <li>Lead with curiosity, not the offer. A hook beats a hard sell.</li>
                  <li>One concrete detail beats five vague ones — fill in Brief facts above.</li>
                  <li><strong>Promotional:</strong> short punchy sentences, 1–2 emojis max at line ends.</li>
                  <li><strong>Friendly:</strong> address the reader as "you", open with a question.</li>
                  <li><strong>Informational:</strong> neutral, no emoji, no claim adjectives.</li>
                  <li>GEO/eligibility lives only in the disclaimer — never in the caption body.</li>
                  <li>If you don't enter a promo code or amount, the AI will not invent one.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {errorMsg && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-start gap-2 pt-6 text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-sm font-medium">{errorMsg}</p>
            </CardContent>
          </Card>
        )}

        {usedShortUrl && !errorMsg && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center gap-2 py-3 text-sm">
              <Link2 className="h-4 w-4 text-primary" />
              <span className="font-medium">Short link:</span>
              <a
                href={usedShortUrl}
                target="_blank"
                rel="noreferrer"
                className="truncate font-mono text-primary underline-offset-2 hover:underline"
              >
                {usedShortUrl}
              </a>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(usedShortUrl, "Short link")}
                className="ml-auto h-7 px-2"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        )}

        {loading && !results && <SocialLoadingSkeleton count={platforms.size} />}

        {!loading && !results && !errorMsg && <SocialEmptyState />}

        {results?.map((p) => (
          <PlatformResult key={p.platform} result={p} onCopy={copy} />
        ))}
      </div>
    </div>
  );
}

function PlatformResult({
  result,
  onCopy,
}: {
  result: PlatformOut;
  onCopy: (text: string, label: string) => void;
}) {
  const policy = PLATFORM_POLICIES[result.platform];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{policy.label}</span>
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">{result.variants.length} variants</span>
      </div>
      {result.error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4 text-sm text-destructive">{result.error}</CardContent>
        </Card>
      )}
      {result.variants.map((v, i) => (
        <VariantCard
          key={i}
          label={`Variant ${String.fromCharCode(65 + i)}`}
          variant={v}
          platformLabel={policy.label}
          onCopy={() =>
            onCopy(
              v.hashtags.length ? `${v.copy}\n\n${v.hashtags.join(" ")}` : v.copy,
              `${policy.label} ${String.fromCharCode(65 + i)}`,
            )
          }
        />
      ))}
    </div>
  );
}

function VariantCard({
  label,
  variant,
  platformLabel,
  onCopy,
}: {
  label: string;
  variant: VariantOut;
  platformLabel: string;
  onCopy: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  if (variant.blocked) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <XCircle className="h-4 w-4" />
            {label} — Blocked by compliance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-destructive">
          <p>{variant.risk_reason || "Could not produce compliant copy after retries."}</p>
          <p className="text-xs text-muted-foreground">
            Refine your brief (remove guarantees, win promises, urgency) and try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  const RiskIcon =
    variant.risk === "low" ? ShieldCheck : variant.risk === "medium" ? Shield : ShieldAlert;
  const riskColor =
    variant.risk === "low"
      ? "text-success"
      : variant.risk === "medium"
        ? "text-warning"
        : "text-destructive";
  const riskBg =
    variant.risk === "low"
      ? "bg-success/10 border-success/30"
      : variant.risk === "medium"
        ? "bg-warning/10 border-warning/30"
        : "bg-destructive/10 border-destructive/40";

  const hasWarnings = variant.missing_elements.length > 0;
  const canCopy = !hasWarnings || acknowledged;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-sm font-semibold">{label}</CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium uppercase tracking-wider", riskBg, riskColor)}>
              <RiskIcon className="h-3 w-3" />
              {variant.risk} risk
            </span>
            {variant.rewritten && (
              <span className="rounded-md border bg-muted px-2 py-0.5 text-muted-foreground">auto-rewritten</span>
            )}
            <span className="text-muted-foreground">{variant.copy.length} chars</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCopy}
          disabled={!canCopy}
          title={!canCopy ? "Acknowledge warnings first" : `Copy ${platformLabel}`}
          className="h-8 px-2"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{variant.copy}</p>
        {variant.hashtags.length > 0 && (
          <p className="text-xs font-medium text-primary">{variant.hashtags.join(" ")}</p>
        )}

        {hasWarnings && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-2.5">
            <div className="flex items-start gap-2 text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {variant.missing_elements.map((m, i) => (
                    <span key={i} className="rounded-md border border-warning/40 bg-background px-1.5 py-0.5 text-xs">
                      {m}
                    </span>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs text-foreground">
                  <Checkbox checked={acknowledged} onCheckedChange={(v) => setAcknowledged(v === true)} />
                  I have reviewed these warnings and want to copy anyway.
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Compliance Report (Issue 6) */}
        <button
          type="button"
          onClick={() => setAuditOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs hover:bg-muted/60"
        >
          <span className="font-medium">
            Compliance report{variant.audit.length > 0 ? ` (${variant.audit.length})` : ""}
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", auditOpen && "rotate-180")} />
        </button>
        {auditOpen && (
          <div className="space-y-2 rounded-md border bg-muted/20 p-2.5 text-xs">
            {variant.risk_reason && (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Why this score:</span> {variant.risk_reason}
              </p>
            )}
            {variant.audit.length === 0 ? (
              <p className="text-muted-foreground">No compliance edits recorded for this variant.</p>
            ) : (
              <ul className="space-y-1.5">
                {variant.audit.map((a, i) => {
                  const rlc =
                    a.risk_level === "High"
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : a.risk_level === "Medium"
                        ? "border-warning/40 bg-warning/10 text-warning"
                        : "border-success/40 bg-success/10 text-success";
                  return (
                    <li key={i} className="rounded-md border bg-background p-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-destructive/15 px-1.5 py-0.5 font-mono text-destructive">{a.original_term}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="rounded bg-success/15 px-1.5 py-0.5 font-mono text-success">{a.replacement}</span>
                        <span className={cn("ml-auto rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider", rlc)}>
                          {a.risk_level}
                        </span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{a.reason}</p>
                      {a.rule_reference && (
                        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground/80">{a.rule_reference}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SocialLoadingSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </>
  );
}

function SocialEmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Share2 className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Your social posts will appear here</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Pick a site, link, tone, and write the core idea. We generate 3 compliance-safe variants per platform with a full audit trail.
        </p>
      </CardContent>
    </Card>
  );
}
