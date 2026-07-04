// © 2026 WiamApp. Powered by WiamLabs
// lib/api/bookings.js — All booking-related database calls

import { supabase } from '../supabase';

/**
 * Create a new booking request (customer sends to worker)
 */
export async function createBooking({
  customerId,
  workerProfileId,
  categoryId,
  description,
  scheduledDate,
  locationAddress,
  locationLat,
  locationLng,
  agreedPrice,
  currency = 'GHS',
}) {
  // Step 1: Create the booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      customer_id: customerId,
      worker_id: workerProfileId,
      category_id: categoryId,
      description,
      scheduled_date: scheduledDate,
      location_address: locationAddress,
      location_lat: locationLat,
      location_lng: locationLng,
      agreed_price: agreedPrice,
      currency,
      status: 'pending',
    })
    .select()
    .single();

  if (bookingError) throw bookingError;

  // Step 2: Notify the worker
  await notifyWorker(workerProfileId, booking.id, customerId);

  return booking;
}

/**
 * Get all bookings for a customer
 */
export async function getCustomerBookings(customerId) {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      worker_profiles (
        id,
        hourly_rate,
        users (full_name, avatar_url, phone)
      ),
      categories (name, icon)
    `)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Get all bookings for a worker
 */
export async function getWorkerBookings(workerProfileId) {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      users!bookings_customer_id_fkey (
        id,
        full_name,
        avatar_url,
        phone
      ),
      categories (name, icon)
    `)
    .eq('worker_id', workerProfileId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Get pending bookings for a worker (new requests)
 */
export async function getPendingBookings(workerProfileId) {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      users!bookings_customer_id_fkey (
        full_name, avatar_url, phone
      ),
      categories (name, icon)
    `)
    .eq('worker_id', workerProfileId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Accept a booking (worker action)
 */
export async function acceptBooking(bookingId, customerId) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'accepted', updated_at: new Date() })
    .eq('id', bookingId)
    .select()
    .single();

  if (error) throw error;

  // Notify the customer
  await supabase.from('notifications').insert({
    user_id: customerId,
    title: 'Booking Accepted! 🎉',
    body: 'Your booking request has been accepted. The worker is on the way!',
    type: 'booking',
    data: { booking_id: bookingId },
  });

  return data;
}

/**
 * Reject a booking (worker action)
 */
export async function rejectBooking(bookingId, customerId) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'rejected', updated_at: new Date() })
    .eq('id', bookingId)
    .select()
    .single();

  if (error) throw error;

  // Notify the customer
  await supabase.from('notifications').insert({
    user_id: customerId,
    title: 'Booking Declined',
    body: 'The worker could not take this job. Try another worker nearby.',
    type: 'booking',
    data: { booking_id: bookingId },
  });

  return data;
}

/**
 * Mark booking as completed (worker action)
 */
export async function completeBooking(bookingId, customerId) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'completed', updated_at: new Date() })
    .eq('id', bookingId)
    .select()
    .single();

  if (error) throw error;

  // Notify customer to leave a review
  await supabase.from('notifications').insert({
    user_id: customerId,
    title: 'Job Complete ✅',
    body: 'How was the service? Leave a review to help others.',
    type: 'booking',
    data: { booking_id: bookingId },
  });

  return data;
}

/**
 * Cancel a booking (customer action)
 */
export async function cancelBooking(bookingId) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled', updated_at: new Date() })
    .eq('id', bookingId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Leave a review after a completed booking
 */
export async function leaveReview({ bookingId, customerId, workerProfileId, rating, comment }) {
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      booking_id: bookingId,
      customer_id: customerId,
      worker_id: workerProfileId,
      rating,
      comment,
    })
    .select()
    .single();

  if (error) throw error;

  // Recalculate worker's average rating
  await recalculateWorkerRating(workerProfileId);

  return data;
}

/**
 * Recalculate and update worker's average rating
 */
async function recalculateWorkerRating(workerProfileId) {
  const { data, error } = await supabase
    .from('reviews')
    .select('rating')
    .eq('worker_id', workerProfileId);

  if (error || !data?.length) return;

  const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;

  await supabase
    .from('worker_profiles')
    .update({
      average_rating: Math.round(avg * 10) / 10,
      total_jobs_done: data.length,
    })
    .eq('id', workerProfileId);
}

/**
 * Send notification to worker about new booking
 */
async function notifyWorker(workerProfileId, bookingId, customerId) {
  // Get worker's user_id first
  const { data: workerProfile } = await supabase
    .from('worker_profiles')
    .select('user_id')
    .eq('id', workerProfileId)
    .single();

  if (!workerProfile) return;

  await supabase.from('notifications').insert({
    user_id: workerProfile.user_id,
    title: 'New Job Request! 🔔',
    body: 'A customer wants to book your services. Check it out!',
    type: 'booking',
    data: { booking_id: bookingId },
  });
}
