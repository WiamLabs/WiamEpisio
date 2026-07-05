// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/payments.js — Paystack booking payments (GHS + NGN)

import { Router } from 'express';
import { supabaseAdmin, verifyUserToken } from '../lib/supabaseAdmin.js';
import { usdToLocal } from '../lib/exchangeRates.js';

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
          app: 'wiamapp',
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
    const { planKey, email, currency = 'GHS' } = req.body;

    if (!planKey || !email) {
      return res.status(400).json({ success: false, error: 'planKey and email are required.' });
    }

    const result = await initiateSubscriptionCheckout({ userId: user.id, planKey, email, currency });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Start a subscription checkout initiated from wiamlabs.com's
 * central pricing page, NOT from inside the app — so there is no
 * WiamApp login session to read a user id from. Identifies the
 * account by email instead, the same way Stripe Checkout links do.
 * Everything downstream (the webhook, the activation) is identical
 * to the authenticated path above — same reference format, same
 * metadata shape, same subscription_config lookup.
 */
router.post('/paystack/subscribe-by-email', async (req, res) => {
  try {
    const { planKey, email, currency = 'GHS' } = req.body;

    if (!planKey || !email) {
      return res.status(400).json({ success: false, error: 'planKey and email are required.' });
    }

    const { data: existingUser, error: userLookupErr } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('email', email)
      .maybeSingle();

    if (userLookupErr) throw userLookupErr;
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'No WiamApp account found for that email. Register at wiamapp.com/register first, then come back to upgrade.',
      });
    }
    if (existingUser.role !== 'worker') {
      return res.status(400).json({
        success: false,
        error: 'Pro is a worker plan — this email is not registered as a worker account.',
      });
    }

    const result = await initiateSubscriptionCheckout({ userId: existingUser.id, planKey, email, currency });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

async function initiateSubscriptionCheckout({ userId, planKey, email, currency }) {
  const { data: planConfig, error: planErr } = await supabaseAdmin
    .from('subscription_config')
    .select('*')
    .eq('plan_key', planKey)
    .eq('is_active', true)
    .single();

  if (planErr || !planConfig) {
    throw new Error('That plan does not exist or is not currently available.');
  }

  // IMPORTANT: a standard Ghana/Nigeria Paystack merchant account
  // can only charge in GHS/NGN respectively — passing currency:
  // 'USD' directly here fails with "Currency not supported" unless
  // multi-currency billing was specifically enabled on the account.
  // Convert to the customer's real local currency instead, using
  // the same live-rate helper as the rest of the app.
  const localAmount = await usdToLocal(planConfig.price_usd_web, currency);
  const amountInKobo = Math.round(localAmount * 100);
  const reference = `wiam_sub_${Date.now()}_${userId.slice(0, 8)}`;

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
      metadata: {
        app: 'wiamapp',
        payment_type: 'subscription',
        user_id: userId,
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
    user_id: userId,
    action: 'subscription_checkout_started',
    metadata: { plan_key: planKey, amount_usd: planConfig.price_usd_web, reference },
  });

  return { authorizationUrl: result.data.authorization_url, reference };
}

export default router;
