-- Table to track short.io short links per promotion, with used/unused state
CREATE TABLE public.sms_short_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  short_url TEXT NOT NULL,
  shortio_id TEXT NOT NULL,
  short_domain TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_sms_short_links_promotion_provider_used
  ON public.sms_short_links (promotion_id, provider, used_at);

-- This is an internal admin tool with no user authentication.
-- Server routes will use the service role key to read/write.
-- Enable RLS but do NOT add any permissive policies — this blocks all
-- direct client (anon/authenticated) access. The service role bypasses RLS.
ALTER TABLE public.sms_short_links ENABLE ROW LEVEL SECURITY;