// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/webhooks.js
// Handles webhooks from RevenueCat, Paystack, and Stripe (worldwide ready)

import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { localToUsd } from '../lib/exchangeRates.js';
import { constructStripeWebhookEvent } from '../lib/payments/stripeProvider.js';
import { fulfillBookingPayment } from '../lib/payments/fulfillBookingPayment.js';

const router = Router();

// ─── REVENUECAT WEBHOOK ───────────────────────────────────────
// Called when a user buys, renews, or cancels a subscription in the app
// RevenueCat → POST api.wiamapp.com/api/webhooks/revenuecat

router.post('/revenuecat', async (req, res) => {
  try {
    const event = req.body;

    // Verify the webhook is from RevenueCat
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.REVENUECAT_WEBHOOK_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized webhook' });
    }

    const { type, app_user_id, product_id, expiration_at_ms } = event;

    // Map RevenueCat product IDs to our plan names
    const PLAN_MAP = {
      'com.wiamlabs.wiamapp.basic_monthly':      { plan: 'basic',  commission: 0.10 },
      'com.wiamlabs.wiamapp.pro_monthly':         { plan: 'pro',    commission: 0.07 },
      'com.wiamlabs.wiamapp.spotlight_standard':  { plan: null, boost: 'standard',  days: 3 },
      'com.wiamlabs.wiamapp.spotlight_featured':  { plan: null, boost: 'featured',  days: 7 },
      'com.wiamlabs.wiamapp.spotlight_premium':   { plan: null, boost: 'premium',   days: 14 },
      'com.wiamlabs.wiamapp.spotlight_business':  { plan: null, boost: 'business',  days: 30 },
    };

    const planInfo = PLAN_MAP[product_id];
    if (!planInfo) {
      console.log('Unknown product ID:', product_id);
      return res.json({ received: true });
    }

    // Handle subscription events
    if (type === 'INITIAL_PURCHASE' || type === 'RENEWAL') {
      if (planInfo.plan) {
        // Subscription activated or renewed
        const expiresAt = expiration_at_ms
          ? new Date(expiration_at_ms).toISOString()
          : null;

        // Update worker_profiles — subscription_tier only. The
        // Checkmark badge (verified_badge) is NEVER set here or
        // anywhere in this webhook. It is earned, calculated only
        // by the nightly Eligibility Score job (Section 4B).
        // Paying just lowers the bar that job checks against.
        await supabaseAdmin
          .from('worker_profiles')
          .update({
            subscription_tier: planInfo.plan,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', app_user_id);

        // Record/update the subscription row. One active row per
        // user — look it up first rather than relying on an upsert
        // constraint that doesn't exist on this table.
        const { data: existingSub } = await supabaseAdmin
          .from('subscriptions')
          .select('id')
          .eq('user_id', app_user_id)
          .eq('status', 'active')
          .maybeSingle();

        const subPayload = {
          user_id: app_user_id,
          account_type: 'worker',
          plan_key: planInfo.plan,
          billing_source: 'app',
          status: 'active',
          amount_usd: planInfo.plan === 'pro' ? 7.00 : 2.50,
          revenuecat_product_id: product_id,
          next_billing_date: expiresAt,
        };

        if (existingSub) {
          await supabaseAdmin.from('subscriptions').update(subPayload).eq('id', existingSub.id);
        } else {
          await supabaseAdmin.from('subscriptions').insert({ ...subPayload, started_at: new Date().toISOString() });
        }

        // Notify worker — honest copy. Never claims the badge is
        // active, since paying never activates it directly.
        await supabaseAdmin.from('notifications').insert({
          user_id: app_user_id,
          title: type === 'INITIAL_PURCHASE'
            ? `Welcome to ${planInfo.plan === 'basic' ? 'Basic' : 'Pro'}!`
            : 'Subscription renewed',
          body: `Your ${planInfo.plan} plan is active — lower commission, more visibility, and a shorter climb to earning your Checkmark badge.`,
          type: 'system',
        });

        // Log it
        await supabaseAdmin.from('audit_logs').insert({
          user_id: app_user_id,
          action: type === 'INITIAL_PURCHASE' ? 'subscription_started' : 'subscription_renewed',
          metadata: { plan: planInfo.plan, product_id, source: 'revenuecat' },
        });
      }
    }

    // Handle cancellation or expiration
    if (type === 'CANCELLATION' || type === 'EXPIRATION') {
      if (planInfo.plan) {
        // Downgrade to free. has_checkmark_badge is deliberately
        // left untouched here — if this worker already earned the
        // badge at the free-tier bar, downgrading their plan does
        // not strip it. The next nightly Eligibility Score run will
        // re-check them against the (higher) free-tier bar on its
        // own, exactly as the system is designed to behave.
        await supabaseAdmin
          .from('worker_profiles')
          .update({ subscription_tier: 'free' })
          .eq('user_id', app_user_id);

        await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('user_id', app_user_id)
          .eq('status', 'active');

        // Notify worker
        await supabaseAdmin.from('notifications').insert({
          user_id: app_user_id,
          title: 'Subscription ended',
          body: 'Your subscription has ended. Renew to lower your commission and get back on the path to a higher search placement.',
          type: 'system',
        });

        await supabaseAdmin.from('audit_logs').insert({
          user_id: app_user_id,
          action: 'subscription_ended',
          metadata: { plan: planInfo.plan, reason: type, source: 'revenuecat' },
        });
      }
    }

    // Handle billing issue (payment failed)
    if (type === 'BILLING_ISSUE') {
      await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'past_due' })
        .eq('user_id', app_user_id)
        .eq('status', 'active');

      await supabaseAdmin.from('notifications').insert({
        user_id: app_user_id,
        title: 'Payment issue with your subscription',
        body: 'We could not charge your subscription. Please update your payment method to keep your plan active.',
        type: 'system',
      });
    }

    res.json({ received: true });
  } catch (err) {
    console.error('RevenueCat webhook error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ─── PAYSTACK WEBHOOK ─────────────────────────────────────────
// Called when a booking payment succeeds or fails
// Paystack → POST api.wiamapp.com/api/webhooks/paystack

router.post('/paystack', async (req, res) => {
  try {
    // Verify Paystack webhook signature
    const crypto = await import('crypto');
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).json({ error: 'Invalid Paystack signature' });
    }

    const { event, data } = req.body;

    if (event === 'charge.success') {
      const { reference, metadata, amount, currency } = data;

      // Find the payment record
      const { data: payment } = await supabaseAdmin
        .from('payments')
        .select('*, bookings(*, worker_profiles(user_id))')
        .eq('transaction_ref', reference)
        .single();

      if (!payment) {
        return res.json({ received: true });
      }

      // Handle booking payment (escrow + in-app notify + Brevo emails)
      if (metadata?.payment_type === 'booking') {
        await fulfillBookingPayment({
          reference,
          amountMinor: amount,
          currency,
          provider: 'paystack',
        });
      }

      // Handle website subscription payment
      if (metadata?.payment_type === 'subscription') {
        const { user_id, plan_key } = metadata;

        // Get plan details from subscription_config
        const { data: planConfig } = await supabaseAdmin
          .from('subscription_config')
          .select('*')
          .eq('plan_key', plan_key)
          .single();

        if (planConfig) {
          const isBusinessPlan = ['starter_biz', 'growth_biz', 'enterprise'].includes(plan_key);
          const accountType = isBusinessPlan ? 'business' : 'worker';

          // Calculate next billing date (1 month from now)
          const nextBilling = new Date();
          nextBilling.setMonth(nextBilling.getMonth() + 1);

          // Update the correct profile table for plan tier ONLY.
          // The Checkmark/Gold badge is never set here — Blue is
          // earned via the nightly Eligibility Score job (Section
          // 4B), Gold is manually approved by WiamLabs staff after
          // document review (Section 8B). Paying for a plan here
          // only changes price/commission/visibility, same as the
          // RevenueCat path above.
          if (isBusinessPlan) {
            await supabaseAdmin
              .from('business_profiles')
              .update({ plan: plan_key.replace('_biz', '') })
              .eq('user_id', user_id);
          } else {
            await supabaseAdmin
              .from('worker_profiles')
              .update({ subscription_tier: plan_key })
              .eq('user_id', user_id);
          }

          // Record/update the subscription row — same select-then-
          // update-or-insert pattern as the RevenueCat path, since
          // this table has no upsert-ready constraint.
          const { data: existingSub } = await supabaseAdmin
            .from('subscriptions')
            .select('id')
            .eq('user_id', user_id)
            .eq('status', 'active')
            .maybeSingle();

          const subPayload = {
            user_id,
            account_type: accountType,
            plan_key,
            billing_source: 'web',
            status: 'active',
            amount_usd: planConfig.price_usd_web,
            paystack_subscription_code: reference,
            next_billing_date: nextBilling.toISOString().slice(0, 10),
          };

          let subscriptionId;
          if (existingSub) {
            await supabaseAdmin.from('subscriptions').update(subPayload).eq('id', existingSub.id);
            subscriptionId = existingSub.id;
          } else {
            const { data: newSub } = await supabaseAdmin
              .from('subscriptions')
              .insert({ ...subPayload, started_at: new Date().toISOString() })
              .select('id')
              .single();
            subscriptionId = newSub?.id;
          }

          // Create the real invoice record (Section 5C) — this is
          // the actual billing history a person sees on
          // wiamapp.com/billing, not a fabricated log line.
          await supabaseAdmin.from('subscription_invoices').insert({
            user_id,
            subscription_id: subscriptionId,
            amount_usd: planConfig.price_usd_web,
            currency_billed: currency || 'GHS',
            status: 'paid',
            paystack_ref: reference,
            plan_name: planConfig.plan_name,
            billing_period_start: new Date().toISOString().slice(0, 10),
            billing_period_end: nextBilling.toISOString().slice(0, 10),
          });

          // Notify
          await supabaseAdmin.from('notifications').insert({
            user_id,
            title: `${planConfig.plan_name} activated!`,
            body: `Your subscription is active until ${nextBilling.toLocaleDateString()}.`,
            type: 'system',
          });
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Paystack webhook error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ─── STRIPE WEBHOOK ───────────────────────────────────────────
// Ready for worldwide cards. Enable with STRIPE_WEBHOOK_SECRET +
 // PAYMENTS_STRIPE_ENABLED. Stripe Dashboard → Webhooks →
// https://wiamapp-backend.onrender.com/api/webhooks/stripe
// Events: checkout.session.completed, checkout.session.async_payment_succeeded

router.post('/stripe', async (req, res) => {
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: 'Stripe webhooks not configured yet.' });
    }

    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    const event = constructStripeWebhookEvent(req.body, signature);

    if (
      event.type === 'checkout.session.completed'
      || event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const session = event.data.object;
      const reference = session.client_reference_id || session.metadata?.reference;
      const paymentType = session.metadata?.payment_type || 'booking';
      const currency = (session.currency || 'usd').toUpperCase();
      const amountMinor = session.amount_total;

      if (paymentType === 'booking' && reference) {
        await fulfillBookingPayment({
          reference,
          amountMinor,
          currency,
          provider: 'stripe',
        });
      }

      if (paymentType === 'subscription' && session.metadata?.user_id && session.metadata?.plan_key) {
        const user_id = session.metadata.user_id;
        const plan_key = session.metadata.plan_key;

        const { data: planConfig } = await supabaseAdmin
          .from('subscription_config')
          .select('*')
          .eq('plan_key', plan_key)
          .maybeSingle();

        if (planConfig) {
          const isBusinessPlan = ['starter_biz', 'growth_biz', 'enterprise'].includes(plan_key);
          const accountType = isBusinessPlan ? 'business' : 'worker';
          const nextBilling = new Date();
          nextBilling.setMonth(nextBilling.getMonth() + 1);

          if (isBusinessPlan) {
            await supabaseAdmin
              .from('business_profiles')
              .update({ plan: plan_key.replace('_biz', '') })
              .eq('user_id', user_id);
          } else {
            await supabaseAdmin
              .from('worker_profiles')
              .update({ subscription_tier: plan_key })
              .eq('user_id', user_id);
          }

          const { data: existingSub } = await supabaseAdmin
            .from('subscriptions')
            .select('id')
            .eq('user_id', user_id)
            .eq('status', 'active')
            .maybeSingle();

          const subPayload = {
            user_id,
            account_type: accountType,
            plan_key,
            billing_source: 'web',
            status: 'active',
            amount_usd: planConfig.price_usd_web,
            next_billing_date: nextBilling.toISOString().slice(0, 10),
          };

          let subscriptionId;
          if (existingSub) {
            await supabaseAdmin.from('subscriptions').update(subPayload).eq('id', existingSub.id);
            subscriptionId = existingSub.id;
          } else {
            const { data: newSub } = await supabaseAdmin
              .from('subscriptions')
              .insert({ ...subPayload, started_at: new Date().toISOString() })
              .select('id')
              .single();
            subscriptionId = newSub?.id;
          }

          await supabaseAdmin.from('subscription_invoices').insert({
            user_id,
            subscription_id: subscriptionId,
            amount_usd: planConfig.price_usd_web,
            currency_billed: currency,
            status: 'paid',
            paystack_ref: reference || session.id,
            plan_name: planConfig.plan_name,
            billing_period_start: new Date().toISOString().slice(0, 10),
            billing_period_end: nextBilling.toISOString().slice(0, 10),
          });

          await supabaseAdmin.from('notifications').insert({
            user_id,
            title: `${planConfig.plan_name} activated!`,
            body: `Your subscription is active until ${nextBilling.toLocaleDateString()}.`,
            type: 'system',
          });
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook error:', err.message);
    res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }
});

export default router;
