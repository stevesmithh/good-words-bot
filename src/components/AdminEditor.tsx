import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2, Settings, Lock, Users, BarChart3 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useCatalog, type Site, type Promotion, type Provider } from "@/lib/catalog";
import { getSession, setSession } from "@/lib/session";

const SESSION_KEY = "admin_code";

function getStoredCode(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(SESSION_KEY);
}

async function api(action: string, payload: Record<string, unknown>) {
  const code = getStoredCode();
  if (!code) throw new Error("Not authenticated");
  const res = await fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, code, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      sessionStorage.removeItem(SESSION_KEY);
    }
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export function AdminButton() {
  const [open, setOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (getStoredCode()) setUnlocked(true);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
        title="Admin Editor"
      >
        <Settings className="h-4 w-4" />
        <span className="hidden sm:inline">Editor</span>
      </Button>
      {open && !unlocked && (
        <CodeDialog
          onClose={() => setOpen(false)}
          onUnlock={() => setUnlocked(true)}
        />
      )}
      {open && unlocked && <EditorDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function CodeDialog({ onClose, onUnlock }: { onClose: () => void; onUnlock: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Wrong code");
        return;
      }
      sessionStorage.setItem(SESSION_KEY, code);
      onUnlock();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" /> Admin Access
          </DialogTitle>
          <DialogDescription>Enter the access code.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Input
            autoFocus
            type="password"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError("");
            }}
            placeholder="••••"
            className="text-center text-2xl tracking-[0.5em]"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={code.length === 0 || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditorDialog({ onClose }: { onClose: () => void }) {
  const { data, isLoading } = useCatalog();

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" /> Admin Editor
          </DialogTitle>
          <DialogDescription>
            Manage sites, promotions, and SMS providers. Changes apply instantly.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Tabs defaultValue="sites" className="flex-1 flex flex-col min-h-0">
            <TabsList className={`grid w-full ${getSession()?.isAdmin ? "grid-cols-5" : "grid-cols-3"}`}>
              <TabsTrigger value="sites">Sites ({data.sites.length})</TabsTrigger>
              <TabsTrigger value="promotions">Promotions ({data.promotions.length})</TabsTrigger>
              <TabsTrigger value="providers">SMS Providers ({data.providers.length})</TabsTrigger>
              {getSession()?.isAdmin && (
                <>
                  <TabsTrigger value="usage" className="gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5" /> Usage
                  </TabsTrigger>
                  <TabsTrigger value="team" className="gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Team
                  </TabsTrigger>
                </>
              )}
            </TabsList>
            <TabsContent value="sites" className="flex-1 min-h-0">
              <SitesEditor sites={data.sites} />
            </TabsContent>
            <TabsContent value="promotions" className="flex-1 min-h-0">
              <PromotionsEditor promotions={data.promotions} sites={data.sites} />
            </TabsContent>
            <TabsContent value="providers" className="flex-1 min-h-0">
              <ProvidersEditor providers={data.providers} />
            </TabsContent>
            {getSession()?.isAdmin && (
              <>
                <TabsContent value="usage" className="flex-1 min-h-0">
                  <UsagePanel />
                </TabsContent>
                <TabsContent value="team" className="flex-1 min-h-0">
                  <TeamPanel />
                </TabsContent>
              </>
            )}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Sites ---------- */
function SitesEditor({ sites }: { sites: Site[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, Partial<Site>>>({});
  const [newSite, setNewSite] = useState({ id: "", name: "", short_domain: "" });
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["catalog"] });

  const save = async (id: string) => {
    const patch = editing[id];
    if (!patch) return;
    const current = sites.find((s) => s.id === id);
    if (!current) return;
    setBusy(id);
    try {
      await api("upsertSite", {
        id,
        name: current.name,
        short_domain: current.short_domain,
        ...patch,
      });
      toast.success("Saved");
      setEditing((e) => {
        const { [id]: _, ...rest } = e;
        return rest;
      });
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(`Delete site "${id}" and all its promotions?`)) return;
    setBusy(id);
    try {
      await api("deleteSite", { id });
      toast.success("Deleted");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const add = async () => {
    if (!newSite.id || !newSite.name || !newSite.short_domain) {
      toast.error("All fields required");
      return;
    }
    setBusy("__new");
    try {
      await api("upsertSite", { ...newSite });
      toast.success("Site added");
      setNewSite({ id: "", name: "", short_domain: "" });
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollArea className="h-[55vh] pr-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Short Domain</TableHead>
            <TableHead className="w-[120px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sites.map((s) => {
            const patch = editing[s.id] ?? {};
            const dirty = Object.keys(patch).length > 0;
            return (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.id}</TableCell>
                <TableCell>
                  <Input
                    value={patch.name ?? s.name}
                    onChange={(e) =>
                      setEditing((p) => ({ ...p, [s.id]: { ...p[s.id], name: e.target.value } }))
                    }
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={patch.short_domain ?? s.short_domain}
                    onChange={(e) =>
                      setEditing((p) => ({
                        ...p,
                        [s.id]: { ...p[s.id], short_domain: e.target.value },
                      }))
                    }
                    placeholder="e.g. dr0p.cc"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => save(s.id)}
                      disabled={!dirty || busy === s.id}
                    >
                      {busy === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(s.id)}
                      disabled={busy === s.id}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          <TableRow className="bg-muted/40">
            <TableCell>
              <Input
                placeholder="new-site-id"
                value={newSite.id}
                onChange={(e) => setNewSite({ ...newSite, id: e.target.value })}
                className="font-mono text-xs"
              />
            </TableCell>
            <TableCell>
              <Input
                placeholder="Display Name"
                value={newSite.name}
                onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
              />
            </TableCell>
            <TableCell>
              <Input
                placeholder="example.cc"
                value={newSite.short_domain}
                onChange={(e) => setNewSite({ ...newSite, short_domain: e.target.value })}
              />
            </TableCell>
            <TableCell>
              <Button size="sm" onClick={add} disabled={busy === "__new"}>
                {busy === "__new" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

/* ---------- Promotions ---------- */
function PromotionsEditor({ promotions, sites }: { promotions: Promotion[]; sites: Site[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, Partial<Promotion>>>({});
  const [filterSite, setFilterSite] = useState<string>("all");
  const [newP, setNewP] = useState({ id: "", site_id: sites[0]?.id ?? "", name: "", destination_url: "" });
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["catalog"] });
  const filtered = filterSite === "all" ? promotions : promotions.filter((p) => p.site_id === filterSite);

  const save = async (id: string) => {
    const patch = editing[id];
    if (!patch) return;
    const current = promotions.find((p) => p.id === id);
    if (!current) return;
    setBusy(id);
    try {
      await api("upsertPromotion", {
        id,
        site_id: current.site_id,
        name: current.name,
        destination_url: current.destination_url,
        short_domain_override: current.short_domain_override,
        ...patch,
      });
      toast.success("Saved");
      setEditing((e) => {
        const { [id]: _, ...rest } = e;
        return rest;
      });
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(`Delete promotion "${id}"?`)) return;
    setBusy(id);
    try {
      await api("deletePromotion", { id });
      toast.success("Deleted");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const add = async () => {
    if (!newP.id || !newP.name || !newP.destination_url || !newP.site_id) {
      toast.error("All fields required");
      return;
    }
    setBusy("__new");
    try {
      await api("upsertPromotion", { ...newP });
      toast.success("Promotion added");
      setNewP({ id: "", site_id: newP.site_id, name: "", destination_url: "" });
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 h-[55vh]">
      <div className="flex items-center gap-2">
        <Label className="text-xs">Filter by site:</Label>
        <Select value={filterSite} onValueChange={setFilterSite}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sites</SelectItem>
            {sites.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} shown</span>
      </div>
      <ScrollArea className="flex-1 pr-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">ID</TableHead>
              <TableHead className="w-[140px]">Site</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Destination URL</TableHead>
              <TableHead className="w-[140px]">Domain Override</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => {
              const patch = editing[p.id] ?? {};
              const dirty = Object.keys(patch).length > 0;
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs break-all">{p.id}</TableCell>
                  <TableCell>
                    <Select
                      value={patch.site_id ?? p.site_id}
                      onValueChange={(v) =>
                        setEditing((e) => ({ ...e, [p.id]: { ...e[p.id], site_id: v } }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sites.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={patch.name ?? p.name}
                      onChange={(e) =>
                        setEditing((ed) => ({ ...ed, [p.id]: { ...ed[p.id], name: e.target.value } }))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={patch.destination_url ?? p.destination_url}
                      onChange={(e) =>
                        setEditing((ed) => ({
                          ...ed,
                          [p.id]: { ...ed[p.id], destination_url: e.target.value },
                        }))
                      }
                      className="text-xs"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={patch.short_domain_override ?? p.short_domain_override ?? ""}
                      onChange={(e) =>
                        setEditing((ed) => ({
                          ...ed,
                          [p.id]: { ...ed[p.id], short_domain_override: e.target.value || null },
                        }))
                      }
                      placeholder="(use site default)"
                      className="text-xs"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => save(p.id)}
                        disabled={!dirty || busy === p.id}
                      >
                        {busy === p.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Save className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(p.id)}
                        disabled={busy === p.id}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow className="bg-muted/40">
              <TableCell>
                <Input
                  placeholder="unique-id"
                  value={newP.id}
                  onChange={(e) => setNewP({ ...newP, id: e.target.value })}
                  className="font-mono text-xs"
                />
              </TableCell>
              <TableCell>
                <Select value={newP.site_id} onValueChange={(v) => setNewP({ ...newP, site_id: v })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Input
                  placeholder="Promotion name"
                  value={newP.name}
                  onChange={(e) => setNewP({ ...newP, name: e.target.value })}
                />
              </TableCell>
              <TableCell colSpan={2}>
                <Input
                  placeholder="https://..."
                  value={newP.destination_url}
                  onChange={(e) => setNewP({ ...newP, destination_url: e.target.value })}
                  className="text-xs"
                />
              </TableCell>
              <TableCell>
                <Button size="sm" onClick={add} disabled={busy === "__new"}>
                  {busy === "__new" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

/* ---------- Providers ---------- */
function ProvidersEditor({ providers }: { providers: Provider[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["catalog"] });

  const save = async (id: string) => {
    const name = editing[id];
    if (!name) return;
    setBusy(id);
    try {
      await api("upsertProvider", { id, name });
      toast.success("Saved");
      setEditing((e) => {
        const { [id]: _, ...rest } = e;
        return rest;
      });
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this provider?")) return;
    setBusy(id);
    try {
      await api("deleteProvider", { id });
      toast.success("Deleted");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const add = async () => {
    if (!newName.trim()) return;
    setBusy("__new");
    try {
      await api("upsertProvider", { name: newName.trim() });
      toast.success("Provider added");
      setNewName("");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollArea className="h-[55vh] pr-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-[120px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {providers.map((p) => {
            const newVal = editing[p.id];
            const dirty = newVal !== undefined && newVal !== p.name;
            return (
              <TableRow key={p.id}>
                <TableCell>
                  <Input
                    value={newVal ?? p.name}
                    onChange={(e) => setEditing((ed) => ({ ...ed, [p.id]: e.target.value }))}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => save(p.id)}
                      disabled={!dirty || busy === p.id}
                    >
                      {busy === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(p.id)}
                      disabled={busy === p.id}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          <TableRow className="bg-muted/40">
            <TableCell>
              <Input
                placeholder="New provider name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </TableCell>
            <TableCell>
              <Button size="sm" onClick={add} disabled={busy === "__new" || !newName.trim()}>
                {busy === "__new" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

/* ---------- Team & Usage (admin only) ---------- */

async function authApi(action: string, payload: Record<string, unknown> = {}) {
  const s = getSession();
  if (!s) throw new Error("Not signed in");
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, username: s.username, password: s.password, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

type DateFilter = "today" | "yesterday" | "7d" | "custom";

type UsageRow = { username: string; email: number; sms: number; total: number };
type RecentRow = { username: string; kind: string; created_at: string };
type UsageResp = {
  from: string;
  to: string;
  summary: UsageRow[];
  totals: { email: number; sms: number; total: number };
  recent: RecentRow[];
};

function UsagePanel() {
  const [filter, setFilter] = useState<DateFilter>("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<UsageResp | null>(null);
  const [error, setError] = useState("");

  const load = async (f: DateFilter, fromVal?: string, toVal?: string) => {
    setLoading(true);
    setError("");
    try {
      const payload: Record<string, unknown> = { filter: f };
      if (f === "custom") {
        if (!fromVal || !toVal) {
          setError("Pick both dates");
          setLoading(false);
          return;
        }
        payload.from = fromVal;
        payload.to = toVal;
      }
      const data = (await authApi("usage", payload)) as UsageResp;
      setResp(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load("today");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (f: DateFilter) => {
    setFilter(f);
    if (f !== "custom") void load(f);
  };

  return (
    <div className="flex flex-col gap-3 h-[55vh]">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border bg-background p-0.5">
          {(["today", "yesterday", "7d", "custom"] as DateFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => pick(f)}
              className={`rounded-sm px-3 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "today" ? "Today" : f === "yesterday" ? "Yesterday" : f === "7d" ? "Last 7 days" : "Custom"}
            </button>
          ))}
        </div>
        {filter === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-[150px]" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-[150px]" />
            <Button size="sm" onClick={() => load("custom", from, to)} disabled={loading}>
              Apply
            </Button>
          </div>
        )}
        <div className="ml-auto text-xs text-muted-foreground">
          {resp && (
            <>
              Total: <strong className="text-foreground">{resp.totals.total}</strong>{" "}
              ({resp.totals.email} email, {resp.totals.sms} sms)
            </>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <ScrollArea className="flex-1 pr-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !resp || resp.summary.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No generations in this period.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Emails</TableHead>
                  <TableHead className="text-right">SMS</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resp.summary.map((r) => (
                  <TableRow key={r.username}>
                    <TableCell className="font-medium">{r.username}</TableCell>
                    <TableCell className="text-right">{r.email}</TableCell>
                    <TableCell className="text-right">{r.sms}</TableCell>
                    <TableCell className="text-right font-semibold">{r.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {resp.recent.length > 0 && (
              <div className="mt-6">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent activity (last {resp.recent.length})
                </h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Kind</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resp.recent.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                        <TableCell>{r.username}</TableCell>
                        <TableCell className="capitalize">{r.kind}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </ScrollArea>
    </div>
  );
}

type Member = {
  id: string;
  username: string;
  is_admin: boolean;
  created_at: string;
};

type MemberPatch = {
  username?: string;
  password?: string;
  is_admin?: boolean;
};


function TeamPanel() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<Member>>>({});
  const [nw, setNw] = useState({ username: "", password: "", is_admin: false });

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await authApi("listMembers");
      setMembers(data.members as Member[]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const save = async (m: Member) => {
    const patch = edits[m.id] ?? {};
    setBusy(m.id);
    try {
      const newUsername = patch.username ?? m.username;
      const newPassword = patch.password ?? m.password;
      const newIsAdmin = patch.is_admin ?? m.is_admin;
      await authApi("upsertMember", {
        id: m.id,
        newUsername,
        newPassword,
        isAdmin: newIsAdmin,
      });
      // If admin edited their own account, refresh local session credentials
      // so subsequent authenticated requests don't 401.
      const sess = getSession();
      if (sess && sess.username === m.username) {
        setSession({ username: newUsername, password: newPassword, isAdmin: newIsAdmin });
      }
      toast.success("Saved");
      setEdits((e) => {
        const { [m.id]: _, ...rest } = e;
        return rest;
      });
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (m: Member) => {
    if (!confirm(`Delete user "${m.username}"?`)) return;
    setBusy(m.id);
    try {
      await authApi("deleteMember", { id: m.id });
      toast.success("Deleted");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const add = async () => {
    if (!nw.username.trim() || !nw.password.trim()) {
      toast.error("Username and password required");
      return;
    }
    setBusy("__new");
    try {
      await authApi("upsertMember", {
        newUsername: nw.username.trim(),
        newPassword: nw.password,
        isAdmin: nw.is_admin,
      });
      toast.success("Member added");
      setNw({ username: "", password: "", is_admin: false });
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollArea className="h-[55vh] pr-2">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Password</TableHead>
              <TableHead className="w-[80px] text-center">Admin</TableHead>
              <TableHead className="w-[110px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => {
              const patch = edits[m.id] ?? {};
              const dirty = Object.keys(patch).length > 0;
              return (
                <TableRow key={m.id}>
                  <TableCell>
                    <Input
                      value={patch.username ?? m.username}
                      onChange={(e) =>
                        setEdits((p) => ({ ...p, [m.id]: { ...p[m.id], username: e.target.value } }))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={patch.password ?? m.password}
                      onChange={(e) =>
                        setEdits((p) => ({ ...p, [m.id]: { ...p[m.id], password: e.target.value } }))
                      }
                      className="font-mono text-xs"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={patch.is_admin ?? m.is_admin}
                      onCheckedChange={(v) =>
                        setEdits((p) => ({ ...p, [m.id]: { ...p[m.id], is_admin: !!v } }))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => save(m)}
                        disabled={!dirty || busy === m.id}
                      >
                        {busy === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(m)}
                        disabled={busy === m.id}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow className="bg-muted/40">
              <TableCell>
                <Input
                  placeholder="username"
                  value={nw.username}
                  onChange={(e) => setNw({ ...nw, username: e.target.value })}
                />
              </TableCell>
              <TableCell>
                <Input
                  placeholder="password"
                  value={nw.password}
                  onChange={(e) => setNw({ ...nw, password: e.target.value })}
                  className="font-mono text-xs"
                />
              </TableCell>
              <TableCell className="text-center">
                <Checkbox
                  checked={nw.is_admin}
                  onCheckedChange={(v) => setNw({ ...nw, is_admin: !!v })}
                />
              </TableCell>
              <TableCell>
                <Button size="sm" onClick={add} disabled={busy === "__new"}>
                  {busy === "__new" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </ScrollArea>
  );
}
