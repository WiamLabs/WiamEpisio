// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/payments.js — Paystack booking payments (GHS + NGN)

import { Router } from 'express';
import { supabaseAdmin, verifyUserToken } from '../lib/supabaseAdmin.js';

const router = Router();

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// ─── PAYSTACK ─────────────────────────────────────────────────

/**
 * Initiate Paystack payment
 * Customer pays for a booking — opens Paystack checkout in a WebView.
 * Inside Paystack the customer can choose MoMo, bank card, etc.
 */
router.post('/paystack/initiate', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { bookingId, amount, currency = 'NGN', email } = req.body;

    if (!bookingId || !amount || !email) {
      return res.status(400).json({ error: 'bookingId, amount and email are required.' });
    }

    // Paystack expects amount in kobo (multiply by 100)
    const amountInKobo = Math.round(amount * 100);

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountInKobo,
        currency,
        reference: `wiam_${Date.now()}_${bookingId.slice(0, 8)}`,
        metadata: {
          booking_id: bookingId,
          custom_fields: [
            { display_name: 'App', value: 'WiamApp' },
            { display_name: 'Powered By', value: 'WiamLabs' },
          ],
        },
        callback_url: 'https://wiamapp.com/payment/success',
      }),
    });

    const result = await paystackRes.json();
    if (!result.status) throw new Error(result.message);

    // Save pending payment
    await supabaseAdmin.from('payments').insert({
      booking_id: bookingId,
      payer_id: user.id,
      amount,
      currency,
      payment_method: 'paystack',
      payment_status: 'pending',
      transaction_ref: result.data.reference,
    });

    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'payment_initiated',
      metadata: { booking_id: bookingId, method: 'paystack', amount },
    });

    // Return the Paystack authorization URL — open this in a WebView
    res.json({
      authorizationUrl: result.data.authorization_url,
      reference: result.data.reference,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Verify Paystack payment after callback
 */
router.get('/paystack/verify/:reference', async (req, res) => {
  try {
    await verifyUserToken(req.headers.authorization);

    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${req.params.reference}`,
      { headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET}` } }
    );

    const result = await paystackRes.json();
    const success = result.data?.status === 'success';

    await supabaseAdmin
      .from('payments')
      .update({ payment_status: success ? 'success' : 'failed' })
      .eq('transaction_ref', req.params.reference);

    res.json({ success, status: result.data?.status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Start a WEBSITE subscription purchase (Section 5C). This is the
 * piece that was missing entirely — the webhook in webhooks.js
 * already knows how to RECEIVE a successful subscription charge
 * and create the subscriptions/subscription_invoices rows, but
 * nothing ever actually started that charge with the right
 * metadata. This is that missing initiator.
 *
 * This is ONLY for billing_source = 'web' (wiamapp.com/billing).
 * In-app purchases on iOS/Android go through RevenueCat and never
 * touch this endpoint at all — mixing the two paths is exactly
 * what Section 5C warns against for App Store/Play Store policy.
 */
router.post('/paystack/subscribe', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { planKey, email } = req.body;

    if (!planKey || !email) {
      return res.status(400).json({ success: false, error: 'planKey and email are required.' });
    }

    const { data: planConfig, error: planErr } = await supabaseAdmin
      .from('subscription_config')
      .select('*')
      .eq('plan_key', planKey)
      .eq('is_active', true)
      .single();

    if (planErr || !planConfig) {
      return res.status(404).json({ success: false, error: 'That plan does not exist or is not currently available.' });
    }

    const amountInKobo = Math.round(planConfig.price_usd_web * 100);
    const reference = `wiam_sub_${Date.now()}_${user.id.slice(0, 8)}`;

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountInKobo,
        currency: 'USD', // Paystack settles in USD here; the customer's card is charged the GHS-equivalent automatically by Paystack
        reference,
        metadata: {
          payment_type: 'subscription',
          user_id: user.id,
          plan_key: planKey,
          custom_fields: [
            { display_name: 'App', value: 'WiamApp' },
            { display_name: 'Plan', value: planConfig.plan_name },
          ],
        },
        callback_url: 'https://wiamapp.com/billing/success',
      }),
    });

    const result = await paystackRes.json();
    if (!result.status) throw new Error(result.message);

    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'subscription_checkout_started',
      metadata: { plan_key: planKey, amount_usd: planConfig.price_usd_web, reference },
    });

    res.json({
      success: true,
      authorizationUrl: result.data.authorization_url,
      reference,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
