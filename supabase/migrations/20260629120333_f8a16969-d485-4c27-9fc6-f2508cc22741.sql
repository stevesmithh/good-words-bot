CREATE TABLE public.generation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('email','sms','social')),
  label text,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.generation_history TO service_role;

ALTER TABLE public.generation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access to generation_history"
  ON public.generation_history
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE INDEX idx_generation_history_created_at ON public.generation_history (created_at DESC);
CREATE INDEX idx_generation_history_username ON public.generation_history (username);
CREATE INDEX idx_generation_history_kind ON public.generation_history (kind);