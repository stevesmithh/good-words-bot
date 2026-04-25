import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

async function fetchCatalog(): Promise<Catalog> {
  const [sitesRes, promosRes, providersRes] = await Promise.all([
    supabase.from("sites").select("*").order("sort_order"),
    supabase.from("promotions").select("*").order("sort_order"),
    supabase.from("sms_providers").select("*").order("sort_order"),
  ]);

  if (sitesRes.error) throw sitesRes.error;
  if (promosRes.error) throw promosRes.error;
  if (providersRes.error) throw providersRes.error;

  return {
    sites: (sitesRes.data ?? []) as Site[],
    promotions: (promosRes.data ?? []) as Promotion[],
    providers: (providersRes.data ?? []) as Provider[],
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
