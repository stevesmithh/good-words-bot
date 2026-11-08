import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authFields } from "@/lib/session";
import { LinkPreviewButton } from "@/components/LinkPreview";

export type SheetPromo = { name: string; url: string; details: string };
type SheetSite = { name: string; promotions: SheetPromo[] };

export type SheetPick = { site: string; promo: SheetPromo } | null;

export function useSheetPromos() {
  return useQuery({
    queryKey: ["sheet-promos"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<SheetSite[]> => {
      const res = await fetch("/api/sheet-promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authFields()),
      });
      if (!res.ok) throw new Error(`Could not load promotions (${res.status})`);
      return (await res.json()).sites ?? [];
    },
  });
}

/** Combine the sheet promotion with any optional notes the member typed. */
export function buildOfferText(pick: SheetPick, notes: string): string {
  const extra = notes.trim();
  if (!pick) return extra;
  const base = `Website: ${pick.site}\nPromotion: ${pick.promo.name}\n\n${pick.promo.details.slice(0, 3500)}`;
  return extra ? `${base}\n\nExtra notes from the team: ${extra}` : base;
}

export function SheetPromoPicker({
  value,
  onChange,
}: {
  value: SheetPick;
  onChange: (v: SheetPick) => void;
}) {
  const { data: sites = [], isLoading, error } = useSheetPromos();
  const site = sites.find((s) => s.name === value?.site);
  const siteName = value?.site ?? "";

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Website</Label>
          <Select
            value={siteName || undefined}
            onValueChange={(s) => {
              const first = sites.find((x) => x.name === s);
              onChange(first ? { site: s, promo: { name: "", url: "", details: "" } } : null);
            }}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoading ? "Loading…" : "Choose website"} />
            </SelectTrigger>
            <SelectContent>
              {sites.map((s) => (
                <SelectItem key={s.name} value={s.name}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Promotion</Label>
          <Select
            value={value?.promo.name || undefined}
            onValueChange={(n) => {
              const p = site?.promotions.find((x) => x.name === n);
              if (p && site) onChange({ site: site.name, promo: p });
            }}
            disabled={!site}
          >
            <SelectTrigger>
              <SelectValue placeholder={site ? "Choose promotion" : "Pick a website first"} />
            </SelectTrigger>
            <SelectContent>
              {site?.promotions.map((p) => (
                <SelectItem key={p.name} value={p.name}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">Could not load the promotions sheet.</p>}
      {value?.promo.url && (
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">→ {value.promo.url}</p>
          <LinkPreviewButton url={value.promo.url} />
        </div>
      )}
      {value?.promo.details && (
        <p className="line-clamp-3 text-xs text-muted-foreground">{value.promo.details}</p>
      )}
    </div>
  );
}

export function hasPick(p: SheetPick) {
  return !!p && !!p.promo.name;
}
