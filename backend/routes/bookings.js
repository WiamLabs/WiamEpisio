// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/bookings.js

import { Router } from 'express';
import multer from 'multer';
import { supabaseAdmin, verifyUserToken } from '../lib/supabaseAdmin.js';
import { uploadBookingPhoto } from '../lib/r2Client.js';
import { qualifyReferral } from './referrals.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Create a new booking
router.post('/', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const {
      workerProfileId, categoryId, description,
      scheduledDate, locationAddress, locationLat,
      locationLng, agreedPrice, currency = 'GHS',
    } = req.body;

    if (!workerProfileId || !description || !locationAddress) {
      return res.status(400).json({ error: 'Missing required booking fields.' });
    }

    // Security check — is worker verified?
    const { data: worker } = await supabaseAdmin
      .from('worker_profiles')
      .select('user_id, is_verified, is_available')
      .eq('id', workerProfileId)
      .single();

    if (!worker) return res.status(404).json({ error: 'Worker not found.' });
    if (!worker.is_verified) return res.status(403).json({ error: 'This worker is not yet verified.' });
    if (!worker.is_available) return res.status(403).json({ error: 'This worker is currently unavailable.' });

    // Create the booking
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .insert({
        customer_id: user.id,
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

    if (error) throw error;

    // Notify the worker
    await supabaseAdmin.from('notifications').insert({
      user_id: worker.user_id,
      title: 'New Job Request! 🔔',
      body: 'A customer wants to book your services. Check it out now!',
      type: 'booking',
      data: { booking_id: booking.id },
    });

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'booking_created',
      metadata: { booking_id: booking.id, worker_id: workerProfileId },
    });

    res.status(201).json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all bookings for current user (customer or worker)
router.get('/', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    // Get user role
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    let query;

    if (userData.role === 'worker') {
      // Get worker profile id first
      const { data: workerProfile } = await supabaseAdmin
        .from('worker_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      query = supabaseAdmin
        .from('bookings')
        .select(`
          *,
          users!bookings_customer_id_fkey (full_name, avatar_url, phone),
          categories (name, icon)
        `)
        .eq('worker_id', workerProfile.id)
        .order('created_at', { ascending: false });
    } else {
      query = supabaseAdmin
        .from('bookings')
        .select(`
          *,
          worker_profiles (
            id, hourly_rate,
            users (full_name, avatar_url, phone)
          ),
          categories (name, icon)
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get pending bookings for a worker
router.get('/pending', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { data: workerProfile } = await supabaseAdmin
      .from('worker_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!workerProfile) return res.status(404).json({ error: 'Worker profile not found.' });

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        users!bookings_customer_id_fkey (full_name, avatar_url, phone),
        categories (name, icon)
      `)
      .eq('worker_id', workerProfile.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Accept a booking
router.patch('/:id/accept', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'accepted', updated_at: new Date() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Notify customer
    await supabaseAdmin.from('notifications').insert({
      user_id: booking.customer_id,
      title: 'Booking Accepted! 🎉',
      body: 'Your booking has been accepted. The worker is on the way!',
      type: 'booking',
      data: { booking_id: booking.id },
    });

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'booking_accepted',
      metadata: { booking_id: booking.id },
    });

    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Reject a booking
router.patch('/:id/reject', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'rejected', updated_at: new Date() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Notify customer
    await supabaseAdmin.from('notifications').insert({
      user_id: booking.customer_id,
      title: 'Booking Declined',
      body: 'The worker could not take this job. Try another worker nearby.',
      type: 'booking',
      data: { booking_id: booking.id },
    });

    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'booking_rejected',
      metadata: { booking_id: booking.id },
    });

    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Complete a booking
router.patch('/:id/complete', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'completed', updated_at: new Date() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Notify customer to leave a review
    await supabaseAdmin.from('notifications').insert({
      user_id: booking.customer_id,
      title: 'Job Complete ✅',
      body: 'How was the service? Leave a review to help other customers.',
      type: 'booking',
      data: { booking_id: booking.id },
    });

    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'booking_completed',
      metadata: { booking_id: booking.id },
    });

    // Keep the customer's trust score current and check for a
    // repeat-customer referral reward (first-ever completed booking)
    await supabaseAdmin.rpc('recalculate_customer_trust_score', { p_customer_id: booking.customer_id });

    const { count: priorCompleted } = await supabaseAdmin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', booking.customer_id)
      .eq('status', 'completed');

    if (priorCompleted === 1) {
      await qualifyReferral({ referredUserId: booking.customer_id, kind: 'customer_first_booking' });
    }

    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Upload a before/after completion photo for a booking
router.post('/:id/photos', upload.single('file'), async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { phase } = req.body; // 'before' | 'after'
    if (!req.file) return res.status(400).json({ error: 'No file provided.' });
    if (!['before', 'after'].includes(phase)) {
      return res.status(400).json({ error: "phase must be 'before' or 'after'." });
    }

    const url = await uploadBookingPhoto(req.file.buffer, req.params.id, phase);

    const { data: photo, error } = await supabaseAdmin
      .from('booking_photos')
      .insert({ booking_id: req.params.id, phase, photo_url: url, uploaded_by: user.id })
      .select().single();

    if (error) throw error;
    res.status(201).json(photo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all before/after photos for a booking
router.get('/:id/photos', async (req, res) => {
  try {
    await verifyUserToken(req.headers.authorization);
    const { data, error } = await supabaseAdmin
      .from('booking_photos')
      .select('*')
      .eq('booking_id', req.params.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Worker confirms a future-dated (scheduled) booking — holds the
// calendar slot so the customer sees a confirmed appointment
// instead of just an accepted request with a date attached.
router.patch('/:id/schedule-confirm', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .update({ worker_confirmed_slot: true, is_future_booking: true, updated_at: new Date() })
      .eq('id', req.params.id)
      .select().single();

    if (error) throw error;

    await supabaseAdmin.from('notifications').insert({
      user_id: booking.customer_id,
      title: 'Appointment confirmed 📅',
      body: 'The worker has confirmed your scheduled date and time.',
      type: 'booking',
      data: { booking_id: booking.id },
    });

    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'booking_schedule_confirmed',
      metadata: { booking_id: booking.id },
    });

    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Cancel a booking
router.patch('/:id/cancel', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'cancelled', updated_at: new Date() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'booking_cancelled',
      metadata: { booking_id: booking.id },
    });

    await supabaseAdmin.rpc('recalculate_customer_trust_score', { p_customer_id: booking.customer_id });

    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Leave a review
router.post('/:id/review', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { rating, comment, workerProfileId } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }

    const { data, error } = await supabaseAdmin
      .from('reviews')
      .insert({
        booking_id: req.params.id,
        customer_id: user.id,
        worker_id: workerProfileId,
        rating,
        comment,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
