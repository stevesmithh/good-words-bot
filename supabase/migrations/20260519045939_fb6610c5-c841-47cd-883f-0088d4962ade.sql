
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access to team_members"
ON public.team_members FOR ALL
TO anon, authenticated
USING (false) WITH CHECK (false);

CREATE TRIGGER update_team_members_updated_at
BEFORE UPDATE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.generation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('email','sms')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_generation_events_username ON public.generation_events(username);
CREATE INDEX idx_generation_events_created_at ON public.generation_events(created_at DESC);

ALTER TABLE public.generation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access to generation_events"
ON public.generation_events FOR ALL
TO anon, authenticated
USING (false) WITH CHECK (false);

INSERT INTO public.team_members (username, password, is_admin) VALUES
  ('alice',   'alice0125@',   false),
  ('natalie', 'natalie8771@', false),
  ('romeo',   'romeo98771@',  false),
  ('leo',     'leo18882@',    false),
  ('steve',   'steve01001@',  true),
  ('chris',   'chris6001@',   false);
