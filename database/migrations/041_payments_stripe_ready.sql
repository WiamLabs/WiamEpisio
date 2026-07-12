-- © 2026 WiamApp. Powered by WiamLabs
-- 041_payments_stripe_ready.sql
-- Allow Stripe (+ escrow status) on payments for worldwide multi-rail.

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN (
    'momo', 'paystack', 'stripe', 'cash', 'bank_transfer', 'card'
  ));

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_payment_status_check
  CHECK (payment_status IN (
    'pending', 'success', 'failed', 'refunded', 'escrow'
  ));

ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(30);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_usd DECIMAL(12,2);

COMMENT ON COLUMN payments.payment_method IS 'Rail used: paystack (Africa), stripe (worldwide), etc.';
