import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2, Mail, Sparkles, AlertCircle, Inbox, ShieldCheck, Smile } from "lucide-react";
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
import { SPAM_CATEGORIES, type SpamCategoryId } from "@/lib/spam-words";

type Audience = "new" | "active" | "inactive";
type InboxType = "promotional" | "primary" | "friendly";

type PromotionalResult = {
  inboxType: "promotional";
  subject: string;
  preview: string;
  header: string;
  body: string;
  cta: string;
};

type PrimaryResult = {
  inboxType: "primary";
  subject: string;
  preheader: string;
  body: string;
  cta: string;
};

type FriendlyResult = {
  inboxType: "friendly";
  subject: string;
  preheader: string;
  body: string;
  cta: string;
};

type EmailResult = PromotionalResult | PrimaryResult | FriendlyResult;

// Render simple **bold** markdown to <strong> elements.
function renderInlineBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export function EmailGenerator() {
  const [inboxType, setInboxType] = useState<InboxType>("promotional");
  const [offerDetails, setOfferDetails] = useState("");
  const [audience, setAudience] = useState<Audience>("active");
  const [brandName, setBrandName] = useState("");
  const [extraForbidden, setExtraForbidden] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<SpamCategoryId>>(
    () => new Set(SPAM_CATEGORIES.map((c) => c.id)),
  );
  const [offerError, setOfferError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmailResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);

  const toggleCategory = (id: SpamCategoryId) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGenerate = async () => {
    if (!offerDetails.trim()) {
      setOfferError("Please describe the offer before generating.");
      return;
    }
    setOfferError(null);
    setErrorMsg(null);
    setRawError(null);
    setLoading(true);
    setResult(null);

    try {
      const resp = await fetch("/api/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inboxType,
          offerDetails,
          audience,
          brandName: brandName.trim() || undefined,
          extraForbidden: extraForbidden.trim() || undefined,
          activeCategories: Array.from(activeCategories),
        }),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        const msg = (data?.error as string) || `Request failed with status ${resp.status}`;
        setErrorMsg(`API error: ${resp.status} — ${msg}`);
        if (data?.raw) setRawError(String(data.raw));
        toast.error(msg);
        return;
      }

      setResult(data as EmailResult);
      toast.success("Email generated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setLoading(false);
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

  const fullEmail = useMemo(() => {
    if (!result) return "";
    if (result.inboxType === "primary" || result.inboxType === "friendly") {
      return `Subject: ${result.subject}\nPreheader: ${result.preheader}\n\n${result.body}\n\nCTA Button: ${result.cta}`;
    }
    return `Subject: ${result.subject}\nPreview: ${result.preview}\nHeader: ${result.header}\n\nBody:\n${result.body}\n\nCTA Button: ${result.cta}`;
  }, [result]);

  const isStrict = inboxType !== "promotional";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Form */}
      <Card className="relative">
        <span className="absolute -top-2 -right-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold leading-none text-primary-foreground shadow-md">
          v2.0
        </span>
        <CardHeader>
          <CardTitle>Offer details</CardTitle>
          <CardDescription>
            Pick an inbox type, then describe what you are giving away.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Inbox type selector */}
          <div className="space-y-2">
            <Label>Inbox type</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setInboxType("promotional")}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  inboxType === "promotional"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border bg-background hover:border-foreground/30",
                )}
                aria-pressed={inboxType === "promotional"}
              >
                <div className="flex items-center gap-2">
                  <Inbox className="h-4 w-4" />
                  <span className="text-sm font-semibold">Promotional</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Normal marketing email, spam-safe.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setInboxType("primary")}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  inboxType === "primary"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border bg-background hover:border-foreground/30",
                )}
                aria-pressed={inboxType === "primary"}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="text-sm font-semibold">Primary</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Higher deliverability, cleaner tone.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setInboxType("friendly")}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  inboxType === "friendly"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border bg-background hover:border-foreground/30",
                )}
                aria-pressed={inboxType === "friendly"}
              >
                <div className="flex items-center gap-2">
                  <Smile className="h-4 w-4" />
                  <span className="text-sm font-semibold">Friendly</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Simple, easy-to-read tone.
                </p>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="offer">
              Offer <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="offer"
              value={offerDetails}
              onChange={(e) => {
                setOfferDetails(e.target.value);
                if (offerError) setOfferError(null);
              }}
              placeholder={
                isStrict
                  ? 'e.g. "New quests are live: 200 XP per quest, $2 in play credits, more bonus credits at level 5"'
                  : 'e.g. "Up to $8 free play, up to 35% discount, up to 200 XP, 20 free spins"'
              }
              className="min-h-[110px]"
              aria-invalid={!!offerError}
            />
            {offerError && <p className="text-xs text-destructive">{offerError}</p>}
          </div>

          {/* Audience — used in both modes */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="audience">Audience</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
                <SelectTrigger id="audience">
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
              <Label htmlFor="brand">Brand name (optional)</Label>
              <Input
                id="brand"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Acme"
              />
            </div>
          </div>

          {!isStrict && (
            <div className="space-y-2">
              <Label htmlFor="extra">Extra forbidden words (optional)</Label>
              <Input
                id="extra"
                value={extraForbidden}
                onChange={(e) => setExtraForbidden(e.target.value)}
                placeholder="comma, separated, words"
              />
            </div>
          )}

          {!isStrict && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Spam categories to filter</Label>
                <span className="text-xs text-muted-foreground">
                  {activeCategories.size} of {SPAM_CATEGORIES.length} on
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {SPAM_CATEGORIES.map((cat) => {
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
          )}

          {isStrict && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              This mode uses a focused writing style. Brand name and audience are still applied.
            </div>
          )}

          <Button onClick={handleGenerate} disabled={loading} className="w-full" size="lg">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate email
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

        {loading && !result && <LoadingSkeleton />}

        {!loading && !result && !errorMsg && <EmptyState />}

        {result && result.inboxType === "promotional" && (
          <>
            <OutputCard
              title="Subject line"
              value={result.subject}
              onCopy={() => copy(result.subject, "Subject")}
              count={result.subject.length}
              limit={50}
            />
            <OutputCard
              title="Preview text"
              value={result.preview}
              onCopy={() => copy(result.preview, "Preview")}
              count={result.preview.length}
              limit={50}
            />
            <OutputCard
              title="Header"
              value={result.header}
              onCopy={() => copy(result.header, "Header")}
            />
            <OutputCard
              title="Email body"
              value={result.body}
              onCopy={() => copy(result.body, "Body")}
              multiline
            />
            <OutputCard
              title="CTA button"
              value={result.cta}
              onCopy={() => copy(result.cta, "CTA")}
              count={result.cta.length}
              limit={24}
            />
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => copy(fullEmail, "Full email")}
            >
              <Copy className="h-4 w-4" />
              Copy full email
            </Button>
          </>
        )}

        {result && (result.inboxType === "primary" || result.inboxType === "friendly") && (
          <>
            <OutputCard
              title="Subject line"
              value={result.subject}
              onCopy={() => copy(result.subject, "Subject")}
              count={result.subject.length}
              limit={60}
            />
            <OutputCard
              title="Preheader"
              value={result.preheader}
              onCopy={() => copy(result.preheader, "Preheader")}
            />
            <Card>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold">Email body</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copy(result.body, "Body")}
                  className="h-8 px-2"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm leading-relaxed text-foreground">
                  {result.body.split(/\n\n+/).map((para, i) => (
                    <p key={i} className="whitespace-pre-wrap">
                      {renderInlineBold(para)}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
            <OutputCard
              title="CTA button"
              value={result.cta}
              onCopy={() => copy(result.cta, "CTA")}
              count={result.cta.length}
              limit={28}
            />
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => copy(fullEmail, "Full email")}
            >
              <Copy className="h-4 w-4" />
              Copy full email
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function OutputCard({
  title,
  value,
  onCopy,
  count,
  limit,
  multiline,
}: {
  title: string;
  value: string;
  onCopy: () => void;
  count?: number;
  limit?: number;
  multiline?: boolean;
}) {
  const over = count !== undefined && limit !== undefined && count > limit;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {count !== undefined && limit !== undefined && (
            <p
              className={cn(
                "text-xs",
                over ? "font-medium text-destructive" : "text-muted-foreground",
              )}
            >
              {count} / {limit} characters
              {over && " — over limit"}
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onCopy} className="h-8 px-2">
          <Copy className="h-3.5 w-3.5" />
          Copy
        </Button>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "text-sm leading-relaxed text-foreground",
            multiline && "whitespace-pre-wrap",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <>
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            {i === 4 && <Skeleton className="h-3 w-3/5" />}
          </CardContent>
        </Card>
      ))}
    </>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Mail className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Your email will appear here</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Pick an inbox type, fill in the offer, and click generate.
        </p>
      </CardContent>
    </Card>
  );
}
