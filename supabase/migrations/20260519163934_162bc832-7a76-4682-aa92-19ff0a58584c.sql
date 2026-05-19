CREATE TABLE public.recent_sms_outputs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id text,
  sms_type text NOT NULL,
  variant text NOT NULL,
  text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_recent_sms_outputs_lookup
  ON public.recent_sms_outputs (site_id, sms_type, variant, created_at DESC);

ALTER TABLE public.recent_sms_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access to recent_sms_outputs"
  ON public.recent_sms_outputs
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);