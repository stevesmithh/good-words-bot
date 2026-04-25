-- Sites table
CREATE TABLE public.sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_domain TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sites are viewable by everyone"
  ON public.sites FOR SELECT
  USING (true);

-- Promotions table
CREATE TABLE public.promotions (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  short_domain_override TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Promotions are viewable by everyone"
  ON public.promotions FOR SELECT
  USING (true);

CREATE INDEX idx_promotions_site_id ON public.promotions(site_id);

-- SMS Providers table
CREATE TABLE public.sms_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers are viewable by everyone"
  ON public.sms_providers FOR SELECT
  USING (true);

-- Updated_at trigger function (shared)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_sites_updated_at
  BEFORE UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_promotions_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed sites
INSERT INTO public.sites (id, name, short_domain, sort_order) VALUES
  ('BitBetWin', 'BitBetWin', 'dr0p.cc', 1),
  ('BitPlay', 'BitPlay', 'fl1p.link', 2),
  ('WIN777', 'WIN777', 'tap4.cc', 3),
  ('BitOfGold', 'BitOfGold', 'sn4p.click', 4),
  ('BitSpinWin', 'BitSpinWin', 'v1ew.link', 5),
  ('VegasGems', 'VegasGems', 'tapnow.cc', 6);

-- Seed providers
INSERT INTO public.sms_providers (name, sort_order) VALUES
  ('SMSEdge', 1),
  ('Dexatel', 2),
  ('Laaffic', 3);

-- Seed promotions
INSERT INTO public.promotions (id, site_id, name, destination_url, sort_order) VALUES
  ('bitbetwin__quest-achievement', 'BitBetWin', 'Quest Achievement', 'https://bitbetwin.cc/?modal=quest-achievements', 1),
  ('bitplay__quest-achievement', 'BitPlay', 'Quest Achievement', 'https://bitplay.ag/?modal=quest-achievement', 2),
  ('win777__referral-bonus', 'WIN777', 'Referral Bonus', 'https://win777.us/promotion/referral-bonus', 3),
  ('bitbetwin__happy-hours', 'BitBetWin', 'Happy Hours', 'https://bitbetwin.cc/promotion/get-your-50-bounceback-during-happy-hours/', 4),
  ('bitplay__birthday-bonuses', 'BitPlay', 'Birthday bonuses', 'https://bitplay.ag/birthday-bonus', 5),
  ('win777__birthday-bonuses', 'WIN777', 'Birthday bonuses', 'https://win777.us/promotion/birthday-bonus', 6),
  ('bitbetwin__hall-of-fame', 'BitBetWin', 'Hall of Fame', 'https://bitbetwin.cc/hall-of-fame/', 7),
  ('bitplay__referral-bonus', 'BitPlay', 'Referral Bonus', 'https://bitplay.ag/referral-bonus', 8),
  ('win777__aviator-game', 'WIN777', 'Aviator Game', 'https://win777.us/aviator-game', 9),
  ('bitbetwin__home', 'BitBetWin', 'Home', 'https://bitbetwin.cc/', 10),
  ('bitplay__happy-hours-30', 'BitPlay', 'Happy Hours 30%', 'https://bitplay.ag/happy-hours', 11),
  ('win777__payout-party', 'WIN777', 'Payout Party', 'https://win777.us/promotion/payout-party', 12),
  ('bitbetwin__referral-bonus', 'BitBetWin', 'Referral bonus', 'https://bitbetwin.cc/promotion/referral-bonus/', 13),
  ('bitplay__fortune-wheel', 'BitPlay', 'Fortune Wheel', 'https://bitplay.ag/?modal=fortune-wheel', 14),
  ('win777__lucky-dice', 'WIN777', 'Lucky Dice', 'https://win777.us/lucky-dice', 15),
  ('bitbetwin__golden-ticket', 'BitBetWin', 'Golden Ticket', 'https://bitbetwin.cc/events/golden-ticket/', 16),
  ('bitplay__application', 'BitPlay', 'Application', 'https://img.bitplay.ag/public/static/images/bpApk.apk', 17),
  ('win777__spinning-wheel', 'WIN777', 'Spinning Wheel', 'https://win777.us/promotion/spinning-wheel', 18),
  ('bitbetwin__application', 'BitBetWin', 'Application', 'https://img.bitbetwin.cc/uploads/bbwApk.apk', 19),
  ('bitplay__awards-program', 'BitPlay', 'Awards Program', 'https://bitplay.ag/?modal=awards', 20),
  ('win777__application', 'WIN777', 'Application', 'https://img.win777.us/public/static/images/Win777.apk', 21),
  ('bitbetwin__deposit', 'BitBetWin', 'Deposit', 'https://bitbetwin.cc/deposit/', 22),
  ('bitplay__deposit', 'BitPlay', 'Deposit', 'https://bitplay.ag/deposit', 23),
  ('win777__deposit', 'WIN777', 'Deposit', 'https://win777.us/deposit', 24),
  ('bitbetwin__telegram', 'BitBetWin', 'Telegram', 'https://t.me/BitBetWinSales_bot', 25),
  ('bitplay__telegram', 'BitPlay', 'Telegram', 'https://t.me/BitplaySalesbot', 26),
  ('win777__telegram', 'WIN777', 'Telegram', 'https://t.me/WIN777_Sales_bot', 27),
  ('bitbetwin__rewards-rally', 'BitBetWin', 'Rewards Rally', 'https://bitbetwin.cc/events/rally-race/', 28),
  ('bitplay__halloween', 'BitPlay', 'Halloween', 'https://bitplay.ag/halloween-spooktacular', 29),
  ('win777__halloween', 'WIN777', 'Halloween', 'https://win777.us/halloween', 30),
  ('bitbetwin__wheel-of-luck', 'BitBetWin', 'Wheel of Luck', 'https://bitbetwin.cc/?modal=wheel-fortune', 31),
  ('bitplay__withdrawal', 'BitPlay', 'Withdrawal', 'https://bitplay.ag/withdraw', 32),
  ('win777__withdrawal', 'WIN777', 'Withdrawal', 'https://win777.us/redeem', 33),
  ('bitbetwin__withdrawal', 'BitBetWin', 'Withdrawal', 'https://bitbetwin.cc/withdrawal/', 34),
  ('bitplay__thanksgiving', 'BitPlay', 'Thanksgiving', 'https://bitplay.ag/thanksgiving', 35),
  ('win777__thanksgiving', 'WIN777', 'Thanksgiving', 'https://win777.us/thanksgiving-house-of-treasures', 36),
  ('bitbetwin__thanksgiving', 'BitBetWin', 'Thanksgiving', 'https://bitbetwin.cc/thanksgiving/', 37),
  ('bitplay__christmas', 'BitPlay', 'Christmas', 'https://bitplay.ag/christmas', 38),
  ('win777__christmas', 'WIN777', 'Christmas', 'https://win777.us/christmas', 39),
  ('bitbetwin__golden-ticket-2', 'BitBetWin', 'Golden Ticket', 'https://bitbetwin.cc/events/golden-ticket/', 40),
  ('bitplay__valentine-s-day', 'BitPlay', 'Valentine''s Day', 'https://bitplay.ag/valentine', 41),
  ('win777__valentine-s-day', 'WIN777', 'Valentine''s Day', 'https://win777.us/valentines', 42),
  ('bitbetwin__christmas', 'BitBetWin', 'Christmas', 'https://bitbetwin.cc/christmas/', 43),
  ('bitplay__express-deposit', 'BitPlay', 'Express deposit', 'https://bitplay.ag/express-deposit-now', 44),
  ('win777__fast-track', 'WIN777', 'Fast track', 'https://win777.us/promotion/fast-track', 45),
  ('bitbetwin__reddit', 'BitBetWin', 'Reddit', 'https://bitbetwin.cc/promotion/reddit-bonuses/', 46),
  ('bitplay__social-media', 'BitPlay', 'Social media', 'https://bitplay.ag/social-media-bonus', 47),
  ('win777__st-patrick-s-day', 'WIN777', 'St. Patrick''s Day', 'https://win777.us/patricks-day', 48),
  ('bitbetwin__shop', 'BitBetWin', 'Shop', 'https://bitbetwin.cc/?modal=shop', 49),
  ('bitplay__st-patrick-s-day', 'BitPlay', 'St. Patrick''s Day', 'https://bitplay.ag/saint-patrick', 50),
  ('win777__user-levels', 'WIN777', 'User Levels', 'https://win777.us/user/dashboard', 51),
  ('bitbetwin__flash-deposit', 'BitBetWin', 'Flash Deposit', 'https://bitbetwin.cc/promotion/flash-deposit/', 52),
  ('bitplay__easter-s-day', 'BitPlay', 'Easter''s Day', 'https://bitplay.ag/easter-day', 53),
  ('win777__slot-games', 'WIN777', 'Slot Games', 'https://win777.us/games', 54);
