import { useQuery } from "@tanstack/react-query";
import { getSession } from "@/lib/session";

export type Site = {
  id: string;
  name: string;
  short_domain: string;
  sort_order: number;
};

export type Promotion = {
  id: string;
  site_id: string;
  name: string;
  destination_url: string;
  short_domain_override: string | null;
  sort_order: number;
};

export type Provider = {
  id: string;
  name: string;
  sort_order: number;
};

export type Catalog = {
  sites: Site[];
  promotions: Promotion[];
  providers: Provider[];
};

async function fetchProviders(): Promise<Provider[]> {
  const sess = getSession();
  if (!sess) return [];
  try {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "listProviders",
        username: sess.username,
        password: sess.password,
      }),
    });
    if (!res.ok) {
      console.error("[catalog] listProviders failed:", res.status);
      return [];
    }
    const data = await res.json();
    return (data.providers ?? []) as Provider[];
  } catch (err) {
    console.error("[catalog] listProviders error:", err);
    return [];
  }
}

async function fetchSitesAndPromos(): Promise<{ sites: Site[]; promotions: Promotion[] }> {
  const sess = getSession();
  if (!sess) return { sites: [], promotions: [] };
  const res = await fetch("/api/catalog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: sess.username, password: sess.password }),
  });
  if (!res.ok) throw new Error(`Could not load catalog (${res.status})`);
  return res.json();
}

async function fetchCatalog(): Promise<Catalog> {
  const [{ sites, promotions }, providers] = await Promise.all([
    fetchSitesAndPromos(),
    fetchProviders(),
  ]);
  return { sites, promotions, providers };
}

export function useCatalog() {
  return useQuery({
    queryKey: ["catalog"],
    queryFn: fetchCatalog,
    staleTime: 30_000,
  });
}

export const CATALOG_QUERY_KEY = ["catalog"] as const;
