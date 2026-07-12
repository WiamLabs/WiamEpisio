// © 2026 WiamApp. Powered by WiamLabs
// lib/api/payments.js — unified checkout (Paystack today, Stripe when enabled)

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

/**
 * Start escrow checkout for a booking.
 * Returns { provider, checkoutUrl, authorizationUrl, reference }
 */
export async function initiateBookingPayment({
  accessToken,
  bookingId,
  amount,
  currency = 'GHS',
  email,
  countryCode,
}) {
  const res = await fetch(`${BACKEND}/api/payments/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ bookingId, amount, currency, email, countryCode }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Payment initialization failed.');
  return {
    ...data,
    checkoutUrl: data.checkoutUrl || data.authorizationUrl,
  };
}

export async function verifyBookingPayment({ accessToken, reference, provider = 'paystack' }) {
  const res = await fetch(
    `${BACKEND}/api/payments/verify/${encodeURIComponent(reference)}?provider=${provider}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Payment verification failed.');
  return data;
}
