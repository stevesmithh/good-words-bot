ALTER TABLE public.sms_short_links
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'sms',
  ADD COLUMN IF NOT EXISTS manual_label text,
  ALTER COLUMN promotion_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS sms_short_links_channel_idx ON public.sms_short_links(channel);