// © 2026 WiamApp. Powered by WiamLabs
// lib/payments/paystackProvider.js — live Africa rail

const PAYSTACK_SECRET = () => process.env.PAYSTACK_SECRET_KEY;

/**
 * @returns {Promise<{
 *   provider: 'paystack',
 *   checkoutUrl: string,
 *   reference: string,
 *   amountMinor: number,
 *   currency: string,
 * }>}
 */
export async function initiatePaystackCheckout({
  email,
  amount,
  currency = 'GHS',
  reference,
  metadata = {},
  callbackUrl = 'https://wiamapp.com/payment/success',
}) {
  if (!PAYSTACK_SECRET()) {
    throw new Error('Paystack is not configured (PAYSTACK_SECRET_KEY).');
  }

  const amountMinor = Math.round(Number(amount) * 100);
  const ref = reference || `wiam_${Date.now()}`;

  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: amountMinor,
      currency: String(currency).toUpperCase(),
      reference: ref,
      metadata: {
        app: 'wiamapp',
        ...metadata,
        custom_fields: [
          { display_name: 'App', value: 'WiamApp' },
          { display_name: 'Powered By', value: 'WiamLabs' },
          ...(metadata.custom_fields || []),
        ],
      },
      callback_url: callbackUrl,
    }),
  });

  const result = await paystackRes.json();
  if (!result.status) throw new Error(result.message || 'Paystack initialize failed');

  return {
    provider: 'paystack',
    checkoutUrl: result.data.authorization_url,
    reference: result.data.reference,
    amountMinor,
    currency: String(currency).toUpperCase(),
  };
}

export async function verifyPaystackPayment(reference) {
  if (!PAYSTACK_SECRET()) {
    throw new Error('Paystack is not configured (PAYSTACK_SECRET_KEY).');
  }
  const paystackRes = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${PAYSTACK_SECRET()}` } },
  );
  const result = await paystackRes.json();
  const status = result.data?.status;
  return {
    provider: 'paystack',
    success: status === 'success',
    status,
    amountMinor: result.data?.amount,
    currency: result.data?.currency,
    raw: result.data,
  };
}
