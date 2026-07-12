// © 2026 WiamApp. Powered by WiamLabs
// lib/payments/stripeProvider.js — worldwide rail (ready; enable with env flags)
//
 // Uses Stripe Checkout Sessions so mobile can keep the same WebView flow
// as Paystack. Flip PAYMENTS_STRIPE_ENABLED=true + STRIPE_SECRET_KEY when ready.

import Stripe from 'stripe';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'Stripe is not configured. Set STRIPE_SECRET_KEY and PAYMENTS_STRIPE_ENABLED=true when you are ready to go live worldwide.',
    );
  }
  if (String(process.env.PAYMENTS_STRIPE_ENABLED || '').toLowerCase() !== 'true') {
    throw new Error(
      'Stripe code is ready but disabled. Set PAYMENTS_STRIPE_ENABLED=true to accept Stripe payments.',
    );
  }
  return new Stripe(key);
}

/**
 * Create a Stripe Checkout Session (hosted page → WebView / browser).
 * Amount is in major units (e.g. 50.00 USD); converted to minor units here.
 *
 * @returns {Promise<{
 *   provider: 'stripe',
 *   checkoutUrl: string,
 *   reference: string,
 *   sessionId: string,
 *   amountMinor: number,
 *   currency: string,
 *   publishableKey: string|null,
 * }>}
 */
export async function initiateStripeCheckout({
  email,
  amount,
  currency = 'USD',
  reference,
  metadata = {},
  successUrl = 'https://wiamapp.com/payment/success?session_id={CHECKOUT_SESSION_ID}&reference={REF}',
  cancelUrl = 'https://wiamapp.com/payment/cancel',
}) {
  const stripe = getStripe();
  const cur = String(currency).toUpperCase();
  const amountMinor = Math.round(Number(amount) * 100);
  const ref = reference || `wiam_stripe_${Date.now()}`;

  const success = String(successUrl).replace('{REF}', encodeURIComponent(ref));
  const cancel = String(cancelUrl).replace('{REF}', encodeURIComponent(ref));

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: email,
    client_reference_id: ref,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: cur.toLowerCase(),
          unit_amount: amountMinor,
          product_data: {
            name: metadata.product_name || 'WiamApp booking payment',
            description: metadata.product_description || 'Escrow payment via WiamApp',
          },
        },
      },
    ],
    success_url: success,
    cancel_url: cancel,
    metadata: {
      app: 'wiamapp',
      reference: ref,
      ...Object.fromEntries(
        Object.entries(metadata)
          .filter(([, v]) => v != null && typeof v !== 'object')
          .map(([k, v]) => [k, String(v)]),
      ),
    },
    payment_intent_data: {
      metadata: {
        app: 'wiamapp',
        reference: ref,
        booking_id: metadata.booking_id ? String(metadata.booking_id) : '',
        payment_type: metadata.payment_type ? String(metadata.payment_type) : 'booking',
      },
    },
  });

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL.');
  }

  return {
    provider: 'stripe',
    checkoutUrl: session.url,
    reference: ref,
    sessionId: session.id,
    amountMinor,
    currency: cur,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
  };
}

/**
 * Verify by Checkout Session id OR our client_reference_id / metadata.reference
 */
export async function verifyStripePayment(referenceOrSessionId) {
  const stripe = getStripe();
  const id = String(referenceOrSessionId || '');

  let session = null;
  if (id.startsWith('cs_')) {
    session = await stripe.checkout.sessions.retrieve(id);
  } else {
    const list = await stripe.checkout.sessions.list({ limit: 20 });
    session = list.data.find(
      (s) => s.client_reference_id === id || s.metadata?.reference === id,
    ) || null;
  }

  if (!session) {
    return { provider: 'stripe', success: false, status: 'not_found' };
  }

  const paid = session.payment_status === 'paid' || session.status === 'complete';
  return {
    provider: 'stripe',
    success: paid,
    status: session.payment_status,
    sessionId: session.id,
    amountMinor: session.amount_total,
    currency: (session.currency || '').toUpperCase(),
    metadata: session.metadata,
    raw: session,
  };
}

/**
 * Construct + return a verified Stripe event from a raw webhook body.
 * @param {Buffer|string} rawBody
 * @param {string} signatureHeader
 */
export function constructStripeWebhookEvent(rawBody, signatureHeader) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set.');
  }
  const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '', 'utf8');
  return stripe.webhooks.constructEvent(payload, signatureHeader, secret);
}
