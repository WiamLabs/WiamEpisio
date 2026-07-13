// © 2026 WiamApp. Powered by WiamLabs
// lib/payments/fulfillBookingPayment.js — shared post-payment escrow + notify

import { supabaseAdmin } from '../supabaseAdmin.js';
import { localToUsd } from '../exchangeRates.js';
import { sendBookingEmail } from '../resend.js';

/**
 * Mark payment + booking paid/escrow and notify both parties (in-app + Brevo email).
 * Used by Paystack + Stripe webhooks (and verify fallbacks).
 */
export async function fulfillBookingPayment({
  reference,
  amountMinor,
  currency,
  provider = 'paystack',
}) {
  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('*, bookings(*, worker_profiles(user_id))')
    .eq('transaction_ref', reference)
    .maybeSingle();

  if (!payment) {
    return { ok: false, reason: 'payment_not_found' };
  }

  if (payment.payment_status === 'escrow' || payment.payment_status === 'success') {
    return { ok: true, already: true, bookingId: payment.booking_id };
  }

  const booking = payment.bookings;
  const workerUserId = booking?.worker_profiles?.user_id;
  const major = amountMinor != null ? Number(amountMinor) / 100 : Number(payment.amount);
  const cur = (currency || payment.currency || 'GHS').toUpperCase();

  let amountUsd = null;
  try {
    amountUsd = await localToUsd(major, cur);
  } catch {
    amountUsd = null;
  }

  await supabaseAdmin
    .from('payments')
    .update({
      payment_status: 'escrow',
      payment_method: provider,
      ...(amountUsd != null ? { amount_usd: amountUsd } : {}),
    })
    .eq('id', payment.id);

  if (booking?.id) {
    await supabaseAdmin
      .from('bookings')
      .update({
        payment_status: 'paid',
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id);

    const paymentNotifications = [
      {
        user_id: booking.customer_id,
        title: 'Payment confirmed ✅',
        body: "Your payment is held safely. The worker's contact is now available.",
        type: 'payment',
        data: { booking_id: booking.id, provider },
      },
    ];
    if (workerUserId) {
      paymentNotifications.push({
        user_id: workerUserId,
        title: 'Customer payment received 💰',
        body: 'Payment is held in escrow. Complete the job to receive your earnings.',
        type: 'payment',
        data: { booking_id: booking.id, provider },
      });
    }
    await supabaseAdmin.from('notifications').insert(paymentNotifications);

    await supabaseAdmin.from('audit_logs').insert({
      user_id: booking.customer_id,
      action: 'booking_payment_success',
      metadata: {
        booking_id: booking.id,
        amount: major,
        currency: cur,
        reference,
        provider,
      },
    });

    // Brevo confirmation emails (best-effort — never block fulfillment)
    try {
      const userIds = [booking.customer_id, workerUserId].filter(Boolean);
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, email, full_name')
        .in('id', userIds);

      const byId = Object.fromEntries((users || []).map((u) => [u.id, u]));
      const amountLabel = `${cur} ${Number(major).toFixed(2)}`;

      const customer = byId[booking.customer_id];
      if (customer?.email) {
        await sendBookingEmail(customer.email, customer.full_name, {
          title: 'Payment confirmed — WiamApp',
          message: `Your payment of <strong>${amountLabel}</strong> is held safely in escrow. The worker's contact is now available in the app. Open WiamApp to view this booking.`,
        });
      }

      const worker = workerUserId ? byId[workerUserId] : null;
      if (worker?.email) {
        await sendBookingEmail(worker.email, worker.full_name, {
          title: 'Payment received — WiamApp',
          message: `A customer paid <strong>${amountLabel}</strong> for your booking. Funds are held in escrow until the job is completed. Open WiamApp to view details and contact the customer.`,
        });
      }
    } catch (emailErr) {
      console.error('[fulfillBookingPayment] email failed:', emailErr.message);
    }
  }

  return { ok: true, bookingId: payment.booking_id };
}
