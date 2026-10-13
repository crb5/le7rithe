-- PROPOSAL ONLY: do not execute these ALTER TABLE statements without separate approval.
-- Read-only development-data check (executed for the audit):
SELECT 'marketplace_listings.price' AS check_target,
       COUNT(*) FILTER (WHERE price::numeric < 0) AS violating_rows,
       MIN(price::numeric) AS minimum_value,
       COUNT(*) AS total_rows
FROM marketplace_listings
UNION ALL
SELECT 'marketplace_listings.area',
       COUNT(*) FILTER (WHERE area IS NOT NULL AND area::numeric < 0),
       MIN(area::numeric),
       COUNT(*)
FROM marketplace_listings
UNION ALL
SELECT 'marketplace_listings.hours',
       COUNT(*) FILTER (WHERE hours IS NOT NULL AND hours < 0),
       MIN(hours)::numeric,
       COUNT(*)
FROM marketplace_listings
UNION ALL
SELECT 'marketplace_payment_packages.price',
       COUNT(*) FILTER (WHERE price::numeric < 0),
       MIN(price::numeric),
       COUNT(*)
FROM marketplace_payment_packages
UNION ALL
SELECT 'marketplace_payment_packages.duration_days',
       COUNT(*) FILTER (WHERE duration_days <= 0),
       MIN(duration_days)::numeric,
       COUNT(*)
FROM marketplace_payment_packages
UNION ALL
SELECT 'marketplace_payments.amount',
       COUNT(*) FILTER (WHERE amount::numeric < 0),
       MIN(amount::numeric),
       COUNT(*)
FROM marketplace_payments
ORDER BY check_target;

-- Proposed constraints; none of these statements have been run.
ALTER TABLE marketplace_listings
  ADD CONSTRAINT marketplace_listings_price_nonnegative CHECK (price >= 0);
ALTER TABLE marketplace_listings
  ADD CONSTRAINT marketplace_listings_area_nonnegative CHECK (area IS NULL OR area >= 0);
ALTER TABLE marketplace_listings
  ADD CONSTRAINT marketplace_listings_hours_nonnegative CHECK (hours IS NULL OR hours >= 0);
ALTER TABLE marketplace_payment_packages
  ADD CONSTRAINT marketplace_payment_packages_price_nonnegative CHECK (price >= 0);
ALTER TABLE marketplace_payment_packages
  ADD CONSTRAINT marketplace_payment_packages_duration_positive CHECK (duration_days > 0);
ALTER TABLE marketplace_payments
  ADD CONSTRAINT marketplace_payments_amount_nonnegative CHECK (amount >= 0);
