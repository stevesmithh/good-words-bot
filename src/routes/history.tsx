import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, Mail, MessageSquare, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSession } from "@/lib/session";

type Kind = "email" | "sms" | "social";

type HistoryItem = {
  id: string;
  username: string;
  kind: Kind;
  label: string | null;
  created_at: string;
};

type HistoryDetail = HistoryItem & {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

export const Route = createFileRoute("/history")({
  component: HistoryPage,
  head: () => ({
    meta: [
      { title: "Generation History — Copy Generator" },
      { name: "description", content: "Review previous offers and generated email, SMS, and social copy." },
      { property: "og:title", content: "Generation History — Copy Generator" },
      { property: "og:description", content: "Review previous offers and generated email, SMS, and social copy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function HistoryPage() {
  const session = getSession();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [kindFilter, setKindFilter] = useState<"all" | Kind>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [selected, setSelected] = useState<HistoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const isAdmin = !!session?.isAdmin;

  const load = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const resp = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "listHistory",
          username: session.username,
          password: session.password,
          kind: kindFilter === "all" ? undefined : kindFilter,
          filterUsername: userFilter === "all" ? undefined : userFilter,
          period: periodFilter === "all" ? undefined : periodFilter,
          limit: 200,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        toast.error((data?.error as string) || "Failed to load history");
        return;
      }
      setItems((data.items ?? []) as HistoryItem[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kindFilter, userFilter, periodFilter]);

  const openDetail = async (id: string) => {
    if (!session) return;
    setDetailLoading(true);
    try {
      const resp = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getHistory",
          username: session.username,
          password: session.password,
          id,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        toast.error((data?.error as string) || "Failed to load entry");
        return;
      }
      setSelected(data.item as HistoryDetail);
    } finally {
      setDetailLoading(false);
    }
  };

  const usernames = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(i.username));
    return Array.from(set).sort();
  }, [items]);

  if (!session) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Please sign in to view history.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-5 sm:px-6">
          <Link to="/">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-semibold tracking-tight">Generation history</h1>
            <p className="text-xs text-muted-foreground">
              {isAdmin
                ? "Every offer your team entered and the copy that was generated."
                : "The offers you submitted and the copy that was generated for you."}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} className="gap-2" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* List */}
        <Card className="h-fit">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Entries</CardTitle>
              <Badge variant="secondary">{items.length}</Badge>
            </div>
            <div className={`grid gap-2 ${isAdmin ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
              <div>
                <label className="text-xs text-muted-foreground">Type</label>
                <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as typeof kindFilter)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Period</label>
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isAdmin && (
                <div>
                  <label className="text-xs text-muted-foreground">Member</label>
                  <Select value={userFilter} onValueChange={setUserFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {usernames.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading && items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No entries yet.</p>
            ) : (
              <ul className="space-y-2">
                {items.map((it) => (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() => void openDetail(it.id)}
                      className={`w-full rounded-md border p-3 text-left transition-colors hover:bg-muted ${
                        selected?.id === it.id ? "border-primary bg-muted" : "bg-background"
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <KindBadge kind={it.kind} />
                        <span className="text-xs text-muted-foreground">
                          {new Date(it.created_at).toLocaleString()}
                        </span>
                        {isAdmin && (
                          <span className="ml-auto text-xs font-medium">{it.username}</span>
                        )}
                      </div>
                      <p className="line-clamp-2 text-sm">
                        {it.label || <span className="text-muted-foreground">(no offer text)</span>}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Detail */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Entry detail</CardTitle>
            <CardDescription>
              {selected
                ? `${selected.kind.toUpperCase()} • ${selected.username} • ${new Date(selected.created_at).toLocaleString()}`
                : "Select an entry on the left."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {detailLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !selected ? (
              <p className="text-sm text-muted-foreground">Nothing selected.</p>
            ) : (
              <div className="space-y-5">
                <Section title="Offer details / inputs">
                  <JsonView value={selected.input} />
                </Section>
                <Section title="Generated copy">
                  <JsonView value={selected.output} />
                </Section>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function KindBadge({ kind }: { kind: Kind }) {
  if (kind === "email")
    return (
      <Badge variant="secondary" className="gap-1">
        <Mail className="h-3 w-3" /> Email
      </Badge>
    );
  if (kind === "sms")
    return (
      <Badge variant="secondary" className="gap-1">
        <MessageSquare className="h-3 w-3" /> SMS
      </Badge>
    );
  return (
    <Badge variant="secondary" className="gap-1">
      <Share2 className="h-3 w-3" /> Social
    </Badge>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function JsonView({ value }: { value: unknown }) {
  const text = useMemo(() => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);
  return (
    <pre className="max-h-[420px] overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
      {text}
    </pre>
  );
}
