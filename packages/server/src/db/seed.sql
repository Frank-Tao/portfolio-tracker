-- Allocation Buckets
INSERT OR IGNORE INTO buckets (name, color) VALUES
  ('Australian Fixed Income', '#3B82F6'),
  ('Australian Property', '#8B5CF6'),
  ('Australian Equities', '#F59E0B'),
  ('International Equities', '#10B981'),
  ('Global Bonds', '#6366F1'),
  ('International Small Cap', '#EC4899'),
  ('Diversified', '#F97316'),
  ('Asia Pacific', '#14B8A6'),
  ('Cash', '#6B7280');

-- Funds (Vanguard ETFs on ASX)
INSERT OR IGNORE INTO funds (ticker, name, expense_ratio, bucket_id) VALUES
  ('VAF', 'Australian Fixed Interest Index ETF', 0.0010, (SELECT id FROM buckets WHERE name='Australian Fixed Income')),
  ('VAP', 'Australian Property Securities Index ETF', 0.0023, (SELECT id FROM buckets WHERE name='Australian Property')),
  ('VHY', 'Australian Shares High Yield ETF', 0.0025, (SELECT id FROM buckets WHERE name='Australian Equities')),
  ('VAS', 'Australian Shares Index ETF', 0.0007, (SELECT id FROM buckets WHERE name='Australian Equities')),
  ('VESG', 'Ethically Conscious International Shares ETF', 0.0018, (SELECT id FROM buckets WHERE name='International Equities')),
  ('VBND', 'Global Aggregate Bond Index ETF', 0.0020, (SELECT id FROM buckets WHERE name='Global Bonds')),
  ('VGS', 'MSCI Index International Shares ETF', 0.0018, (SELECT id FROM buckets WHERE name='International Equities')),
  ('VISM', 'MSCI International Small Companies ETF', 0.0032, (SELECT id FROM buckets WHERE name='International Small Cap')),
  ('VDHG', 'Diversified High Growth Index ETF', 0.0027, (SELECT id FROM buckets WHERE name='Diversified')),
  ('VAE', 'FTSE Asia ex Japan Shares Index ETF', 0.0040, (SELECT id FROM buckets WHERE name='Asia Pacific')),
  ('V500', 'S&P 500 ETF', 0.0003, (SELECT id FROM buckets WHERE name='International Equities')),
  ('CASHFUND', 'Vanguard Cash Plus Fund', 0.0020, (SELECT id FROM buckets WHERE name='Cash'));

-- Default Profiles
INSERT OR IGNORE INTO profiles (name, description, is_active) VALUES
  ('Growth', 'Higher equity allocation for long-term capital growth', 1),
  ('Balanced', 'Mix of growth and defensive assets', 0),
  ('Conservative', 'Capital preservation with moderate growth', 0);

-- Growth Profile Allocations
INSERT OR IGNORE INTO profile_allocations (profile_id, bucket_id, target_pct) VALUES
  ((SELECT id FROM profiles WHERE name='Growth'), (SELECT id FROM buckets WHERE name='Australian Equities'), 0.15),
  ((SELECT id FROM profiles WHERE name='Growth'), (SELECT id FROM buckets WHERE name='International Equities'), 0.55),
  ((SELECT id FROM profiles WHERE name='Growth'), (SELECT id FROM buckets WHERE name='Australian Fixed Income'), 0.03),
  ((SELECT id FROM profiles WHERE name='Growth'), (SELECT id FROM buckets WHERE name='Global Bonds'), 0.07),
  ((SELECT id FROM profiles WHERE name='Growth'), (SELECT id FROM buckets WHERE name='Australian Property'), 0.05),
  ((SELECT id FROM profiles WHERE name='Growth'), (SELECT id FROM buckets WHERE name='International Small Cap'), 0.15);

-- Balanced Profile Allocations
INSERT OR IGNORE INTO profile_allocations (profile_id, bucket_id, target_pct) VALUES
  ((SELECT id FROM profiles WHERE name='Balanced'), (SELECT id FROM buckets WHERE name='Australian Equities'), 0.20),
  ((SELECT id FROM profiles WHERE name='Balanced'), (SELECT id FROM buckets WHERE name='International Equities'), 0.40),
  ((SELECT id FROM profiles WHERE name='Balanced'), (SELECT id FROM buckets WHERE name='Australian Fixed Income'), 0.10),
  ((SELECT id FROM profiles WHERE name='Balanced'), (SELECT id FROM buckets WHERE name='Global Bonds'), 0.15),
  ((SELECT id FROM profiles WHERE name='Balanced'), (SELECT id FROM buckets WHERE name='Australian Property'), 0.10),
  ((SELECT id FROM profiles WHERE name='Balanced'), (SELECT id FROM buckets WHERE name='International Small Cap'), 0.05);

-- Conservative Profile Allocations
INSERT OR IGNORE INTO profile_allocations (profile_id, bucket_id, target_pct) VALUES
  ((SELECT id FROM profiles WHERE name='Conservative'), (SELECT id FROM buckets WHERE name='Australian Equities'), 0.15),
  ((SELECT id FROM profiles WHERE name='Conservative'), (SELECT id FROM buckets WHERE name='International Equities'), 0.20),
  ((SELECT id FROM profiles WHERE name='Conservative'), (SELECT id FROM buckets WHERE name='Australian Fixed Income'), 0.25),
  ((SELECT id FROM profiles WHERE name='Conservative'), (SELECT id FROM buckets WHERE name='Global Bonds'), 0.25),
  ((SELECT id FROM profiles WHERE name='Conservative'), (SELECT id FROM buckets WHERE name='Australian Property'), 0.10),
  ((SELECT id FROM profiles WHERE name='Conservative'), (SELECT id FROM buckets WHERE name='International Small Cap'), 0.05);
