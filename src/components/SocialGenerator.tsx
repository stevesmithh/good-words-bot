import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Copy,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Sparkles,
  Share2,
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
import { cn } from "@/lib/utils";
import {
  PLATFORM_POLICIES,
  SOCIAL_PLATFORMS,
  SOCIAL_TONES,
  type RiskLevel,
  type SocialPlatform,
  type SocialTone,
} from "@/lib/social-compliance";
import { useCatalog } from "@/lib/catalog";
import { logGeneration } from "@/lib/usage";

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

const DEFAULT_PLATFORMS = new Set<SocialPlatform>(
  SOCIAL_PLATFORMS.map((p) => p.id),
);

export function SocialGenerator() {
  const { data: catalog } = useCatalog();
  const SITES = catalog?.sites ?? [];
  const PROMOTIONS = catalog?.promotions ?? [];

  const [siteId, setSiteId] = useState("");
  const [promotionId, setPromotionId] = useState("");
  const [geo, setGeo] = useState("");
  const [tone, setTone] = useState<SocialTone>("fun");
  const [topic, setTopic] = useState("");
  const [isUsIgaming, setIsUsIgaming] = useState(true);
  const [platforms, setPlatforms] = useState<Set<SocialPlatform>>(
    () => new Set(DEFAULT_PLATFORMS),
  );

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [results, setResults] = useState<PlatformOut[] | null>(null);

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

  const handleGenerate = async () => {
    setErrorMsg(null);
    setResults(null);
    setLoading(true);
    try {
      const payload = {
        siteId: siteId || undefined,
        brandName: siteId || undefined,
        promotionName: selectedPromotion?.name,
        promotionUrl: selectedPromotion?.destination_url,
        topic: topic.trim() || undefined,
        geo: geo.trim() || undefined,
        isUsIgaming,
        tone,
        platforms: Array.from(platforms),
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
      void logGeneration("sms"); // reuses existing usage logger
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
      {/* Form */}
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
                <p className="truncate text-xs text-muted-foreground">→ {selectedPromotion.destination_url}</p>
              )}
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
                Required for US iGaming on Meta. Surfaced into the post text.
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
                    Forces GEO check; flags variants High if GEO is missing.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="s-topic">Topic / angle (optional)</Label>
            <Textarea
              id="s-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. weekend tournament, new game feature spotlight"
              rows={2}
            />
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

          <Button
            onClick={handleGenerate}
            disabled={loading || !promotionId}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Generate posts</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Output */}
      <div className="space-y-4">
        {errorMsg && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-start gap-2 pt-6 text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-sm font-medium">{errorMsg}</p>
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
  onCopy,
}: {
  label: string;
  variant: VariantOut;
  onCopy: () => void;
}) {
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
        <Button variant="ghost" size="sm" onClick={onCopy} className="h-8 px-2">
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{variant.copy}</p>
        {variant.hashtags.length > 0 && (
          <p className="text-xs font-medium text-primary">{variant.hashtags.join(" ")}</p>
        )}
        <p className="text-xs text-muted-foreground">{variant.reasons.join(" · ")}</p>
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
          Pick a site, promotion, GEO, and tone. We generate 3 compliance-safe variants per platform.
        </p>
      </CardContent>
    </Card>
  );
}
