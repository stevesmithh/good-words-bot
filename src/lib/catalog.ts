import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "listProviders",
      username: sess.username,
      password: sess.password,
    }),
  });
  if (!res.ok) throw new Error("Failed to load providers");
  const data = await res.json();
  return (data.providers ?? []) as Provider[];
}

async function fetchCatalog(): Promise<Catalog> {
  const [sitesRes, promosRes, providers] = await Promise.all([
    supabase.from("sites").select("*").order("sort_order"),
    supabase.from("promotions").select("*").order("sort_order"),
    fetchProviders(),
  ]);

  if (sitesRes.error) throw sitesRes.error;
  if (promosRes.error) throw promosRes.error;

  return {
    sites: (sitesRes.data ?? []) as Site[],
    promotions: (promosRes.data ?? []) as Promotion[],
    providers,
  };
}

export function useCatalog() {
  return useQuery({
    queryKey: ["catalog"],
    queryFn: fetchCatalog,
    staleTime: 30_000,
  });
}

export const CATALOG_QUERY_KEY = ["catalog"] as const;
