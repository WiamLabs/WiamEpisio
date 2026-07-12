// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/payments.js — multi-rail payments (Paystack live, Stripe ready)

import { Router } from 'express';
import { supabaseAdmin, verifyUserToken } from '../lib/supabaseAdmin.js';
import { usdToLocal } from '../lib/exchangeRates.js';
import { resolvePaymentProvider, listPaymentProviders } from '../lib/payments/resolveProvider.js';
import { initiatePaystackCheckout, verifyPaystackPayment } from '../lib/payments/paystackProvider.js';
import { initiateStripeCheckout, verifyStripePayment } from '../lib/payments/stripeProvider.js';

const router = Router();

/**
 * GET /api/payments/providers — which rails are configured (ops / debug)
 */
router.get('/providers', (_req, res) => {
  res.json({ success: true, providers: listPaymentProviders() });
});

/**
 * Unified booking checkout.
 * POST /api/payments/initiate
 * Body: { bookingId, amount, currency, email, countryCode?, prefer? }
 * Returns: { provider, checkoutUrl, authorizationUrl, reference, ... }
 *
 * Mobile should prefer this endpoint. Legacy /paystack/initiate still works.
 */
router.post('/initiate', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const {
      bookingId, amount, currency = 'GHS', email,
      countryCode, prefer,
    } = req.body;

    if (!bookingId || !amount || !email) {
      return res.status(400).json({ error: 'bookingId, amount and email are required.' });
    }

    const provider = resolvePaymentProvider({ countryCode, currency, prefer });
    const reference = `wiam_${Date.now()}_${String(bookingId).slice(0, 8)}`;
    const metadata = {
      payment_type: 'booking',
      booking_id: bookingId,
      product_name: 'WiamApp booking escrow',
    };

    let checkout;
    if (provider === 'stripe') {
      checkout = await initiateStripeCheckout({
        email,
        amount,
        currency,
        reference,
        metadata,
      });
    } else {
      checkout = await initiatePaystackCheckout({
        email,
        amount,
        currency,
        reference,
        metadata,
      });
    }

    await supabaseAdmin.from('payments').insert({
      booking_id: bookingId,
      payer_id: user.id,
      amount,
      currency: String(currency).toUpperCase(),
      payment_method: checkout.provider,
      payment_status: 'pending',
      transaction_ref: checkout.reference,
    });

    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'payment_initiated',
      metadata: {
        booking_id: bookingId,
        method: checkout.provider,
        amount,
        currency,
        reference: checkout.reference,
      },
    });

    res.json({
      provider: checkout.provider,
      checkoutUrl: checkout.checkoutUrl,
      // Back-compat for existing mobile WebView code
      authorizationUrl: checkout.checkoutUrl,
      reference: checkout.reference,
      sessionId: checkout.sessionId || null,
      publishableKey: checkout.publishableKey || null,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Unified verify
 * GET /api/payments/verify/:reference?provider=paystack|stripe
 */
router.get('/verify/:reference', async (req, res) => {
  try {
    await verifyUserToken(req.headers.authorization);
    const provider = (req.query.provider || 'paystack').toLowerCase();
    const reference = req.params.reference;

    const result = provider === 'stripe'
      ? await verifyStripePayment(reference)
      : await verifyPaystackPayment(reference);

    if (result.success) {
      await supabaseAdmin
        .from('payments')
        .update({ payment_status: 'success', payment_method: result.provider })
        .eq('transaction_ref', result.raw?.client_reference_id || reference);
      // Prefer exact reference match
      await supabaseAdmin
        .from('payments')
        .update({ payment_status: 'success', payment_method: result.provider })
        .eq('transaction_ref', reference);
    } else {
      await supabaseAdmin
        .from('payments')
        .update({ payment_status: 'failed' })
        .eq('transaction_ref', reference);
    }

    res.json({
      success: result.success,
      status: result.status,
      provider: result.provider,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── LEGACY PAYSTACK PATHS (unchanged URLs for existing APKs) ─

router.post('/paystack/initiate', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { bookingId, amount, currency = 'NGN', email } = req.body;

    if (!bookingId || !amount || !email) {
      return res.status(400).json({ error: 'bookingId, amount and email are required.' });
    }

    const reference = `wiam_${Date.now()}_${String(bookingId).slice(0, 8)}`;
    const checkout = await initiatePaystackCheckout({
      email,
      amount,
      currency,
      reference,
      metadata: { payment_type: 'booking', booking_id: bookingId },
    });

    await supabaseAdmin.from('payments').insert({
      booking_id: bookingId,
      payer_id: user.id,
      amount,
      currency,
      payment_method: 'paystack',
      payment_status: 'pending',
      transaction_ref: checkout.reference,
    });

    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'payment_initiated',
      metadata: { booking_id: bookingId, method: 'paystack', amount },
    });

    res.json({
      authorizationUrl: checkout.checkoutUrl,
      reference: checkout.reference,
      provider: 'paystack',
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/paystack/verify/:reference', async (req, res) => {
  try {
    await verifyUserToken(req.headers.authorization);
    const result = await verifyPaystackPayment(req.params.reference);

    await supabaseAdmin
      .from('payments')
      .update({ payment_status: result.success ? 'success' : 'failed' })
      .eq('transaction_ref', req.params.reference);

    res.json({ success: result.success, status: result.status, provider: 'paystack' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

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

router.post('/paystack/subscribe-by-email', async (req, res) => {
  try {
    const { planKey, email, currency = 'GHS' } = req.body;

    if (!planKey || !email) {
      return res.status(400).json({ success: false, error: 'planKey and email are required.' });
    }

    const BUSINESS_PLAN_KEYS = ['starter_biz', 'growth_biz', 'enterprise'];
    const isBusinessPlan = BUSINESS_PLAN_KEYS.includes(planKey);

    const { data: existingUser, error: userLookupErr } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('email', email)
      .maybeSingle();

    if (userLookupErr) throw userLookupErr;
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: isBusinessPlan
          ? 'No WiamApp business account found for that email. Apply at wiamapp.com/business/apply first, then come back to upgrade.'
          : 'No WiamApp account found for that email. Register at wiamapp.com/register first, then come back to upgrade.',
      });
    }

    if (isBusinessPlan) {
      if (planKey === 'enterprise') {
        return res.status(400).json({
          success: false,
          error: 'Enterprise is sold through sales. Apply at wiamapp.com/business/apply first.',
        });
      }
      if (existingUser.role !== 'business') {
        return res.status(400).json({
          success: false,
          error: 'That plan is for business accounts. Apply at wiamapp.com/business/apply first, then come back to upgrade.',
        });
      }
    } else if (existingUser.role !== 'worker') {
      return res.status(400).json({
        success: false,
        error: 'That plan is for worker accounts. Register as a worker at wiamapp.com/register first.',
      });
    }

    const result = await initiateSubscriptionCheckout({ userId: existingUser.id, planKey, email, currency });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Stripe subscription checkout scaffold (website billing worldwide).
 * Enable later with PAYMENTS_STRIPE_ENABLED=true.
 */
router.post('/stripe/subscribe', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { planKey, email, currency = 'USD' } = req.body;
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
      throw new Error('That plan does not exist or is not currently available.');
    }

    const amount = Number(planConfig.price_usd_web);
    const reference = `wiam_sub_stripe_${Date.now()}_${user.id.slice(0, 8)}`;
    const checkout = await initiateStripeCheckout({
      email,
      amount,
      currency,
      reference,
      metadata: {
        payment_type: 'subscription',
        user_id: user.id,
        plan_key: planKey,
        product_name: planConfig.plan_name || 'WiamApp subscription',
      },
      successUrl: 'https://wiamapp.com/billing/success?session_id={CHECKOUT_SESSION_ID}&reference={REF}',
      cancelUrl: 'https://wiamapp.com/billing/cancel',
    });

    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'subscription_checkout_started',
      metadata: { plan_key: planKey, provider: 'stripe', reference, amount_usd: amount },
    });

    res.json({
      success: true,
      provider: 'stripe',
      authorizationUrl: checkout.checkoutUrl,
      checkoutUrl: checkout.checkoutUrl,
      reference: checkout.reference,
      sessionId: checkout.sessionId,
    });
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

  const localAmount = await usdToLocal(planConfig.price_usd_web, currency);
  const reference = `wiam_sub_${Date.now()}_${userId.slice(0, 8)}`;

  const checkout = await initiatePaystackCheckout({
    email,
    amount: localAmount,
    currency,
    reference,
    metadata: {
      payment_type: 'subscription',
      user_id: userId,
      plan_key: planKey,
      custom_fields: [
        { display_name: 'Plan', value: planConfig.plan_name },
      ],
    },
    callbackUrl: 'https://wiamapp.com/billing/success',
  });

  await supabaseAdmin.from('audit_logs').insert({
    user_id: userId,
    action: 'subscription_checkout_started',
    metadata: { plan_key: planKey, amount_usd: planConfig.price_usd_web, reference },
  });

  return { authorizationUrl: checkout.checkoutUrl, reference: checkout.reference, provider: 'paystack' };
}

export default router;
