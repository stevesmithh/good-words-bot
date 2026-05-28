CREATE TABLE public.recent_social_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text,
  platform text NOT NULL,
  tone text NOT NULL,
  text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.recent_social_outputs TO service_role;

ALTER TABLE public.recent_social_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access to recent_social_outputs"
  ON public.recent_social_outputs
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE INDEX idx_recent_social_outputs_lookup
  ON public.recent_social_outputs (site_id, platform, tone, created_at DESC);