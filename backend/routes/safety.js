// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/safety.js — Worker and Customer Safety Features

import { Router } from 'express';
import { supabaseAdmin, verifyUserToken } from '../lib/supabaseAdmin.js';

const router = Router();

// ─── SOS EMERGENCY ALERT ─────────────────────────────────────

// Trigger SOS for worker OR customer
router.post('/sos', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { bookingId, latitude, longitude, locationName } = req.body;

    // Get current booking details
    let bookingData = null;
    let otherPartyId = null;

    if (bookingId) {
      const { data: booking } = await supabaseAdmin
        .from('bookings')
        .select(`
          *,
          users!bookings_customer_id_fkey (full_name, phone),
          worker_profiles (user_id, users (full_name, phone))
        `)
        .eq('id', bookingId)
        .single();

      if (booking) {
        bookingData = booking;
        // Determine other party
        otherPartyId = booking.customer_id === user.id
          ? booking.worker_profiles?.user_id
          : booking.customer_id;
      }
    }

    // Get user's emergency contact
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('full_name, emergency_contact_name, emergency_contact_phone')
      .eq('id', user.id)
      .single();

    // Record the SOS event
    await supabaseAdmin.from('worker_safety_events').insert({
      user_id: user.id,
      booking_id: bookingId || null,
      event_type: 'sos_worker',
      latitude,
      longitude,
      location_name: locationName,
      other_party_id: otherPartyId,
      alert_sent_to: userData?.emergency_contact_phone,
    });

    // Create urgent notification for ALL admins
    const { data: admins } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('role', 'admin');

    if (admins?.length > 0) {
      const adminNotifications = admins.map(admin => ({
        user_id: admin.id,
        title: '🚨 SOS EMERGENCY ALERT',
        body: `${userData?.full_name} has triggered an SOS. Location: ${locationName || 'See coordinates'}. Booking: ${bookingId || 'No active booking'}`,
        type: 'system',
        data: {
          sos: true,
          user_id: user.id,
          booking_id: bookingId,
          latitude,
          longitude,
          emergency_contact: userData?.emergency_contact_phone,
        },
      }));

      await supabaseAdmin.from('notifications').insert(adminNotifications);
    }

    // Log permanently
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'sos_triggered',
      location_lat: latitude,
      location_lng: longitude,
      metadata: {
        booking_id: bookingId,
        emergency_contact: userData?.emergency_contact_phone,
        other_party_id: otherPartyId,
        location_name: locationName,
      },
    });

    res.json({
      success: true,
      message: 'SOS alert sent. Admin and emergency contact notified.',
      alertSentTo: userData?.emergency_contact_phone || 'WiamLabs admin only',
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── GPS CHECK-IN ────────────────────────────────────────────

// Worker/customer arrives at job location
router.post('/check-in', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { bookingId, latitude, longitude, locationName } = req.body;

    await supabaseAdmin.from('worker_safety_events').insert({
      user_id: user.id,
      booking_id: bookingId,
      event_type: 'check_in',
      latitude,
      longitude,
      location_name: locationName,
    });

    // Update worker profile with current job location
    await supabaseAdmin.from('worker_profiles').update({
      check_in_lat: latitude,
      check_in_lng: longitude,
      check_in_at: new Date().toISOString(),
    }).eq('user_id', user.id);

    // Notify the other party
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('customer_id, worker_user_id')
      .eq('id', bookingId)
      .single();

    if (booking) {
      const notifyId = booking.customer_id === user.id
        ? booking.worker_user_id
        : booking.customer_id;

      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single();

      await supabaseAdmin.from('notifications').insert({
        user_id: notifyId,
        title: `${userData?.full_name} has arrived ✅`,
        body: 'They have checked in at the job location.',
        type: 'booking',
        data: { booking_id: bookingId },
      });
    }

    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'job_check_in',
      location_lat: latitude,
      location_lng: longitude,
      metadata: { booking_id: bookingId },
    });

    res.json({ success: true, message: 'Checked in successfully. Other party notified.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── GPS CHECK-OUT ────────────────────────────────────────────

router.post('/check-out', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { bookingId, latitude, longitude } = req.body;

    await supabaseAdmin.from('worker_safety_events').insert({
      user_id: user.id,
      booking_id: bookingId,
      event_type: 'check_out',
      latitude,
      longitude,
    });

    // Clear check-in data from worker profile
    await supabaseAdmin.from('worker_profiles').update({
      check_in_lat: null,
      check_in_lng: null,
      check_in_at: null,
    }).eq('user_id', user.id);

    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'job_check_out',
      location_lat: latitude,
      location_lng: longitude,
      metadata: { booking_id: bookingId },
    });

    res.json({ success: true, message: 'Checked out successfully.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── UPDATE EMERGENCY CONTACT ─────────────────────────────────

router.put('/emergency-contact', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'Name and phone are required.' });
    }

    await supabaseAdmin
      .from('users')
      .update({
        emergency_contact_name: name,
        emergency_contact_phone: phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    res.json({ success: true, message: 'Emergency contact updated.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── GET EMERGENCY CONTACT ────────────────────────────────────

router.get('/emergency-contact', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('emergency_contact_name, emergency_contact_phone')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── RATE A CUSTOMER ─────────────────────────────────────────

router.post('/rate-customer', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { bookingId, customerId, rating, note } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5.' });
    }

    // Get worker profile id
    const { data: workerProfile } = await supabaseAdmin
      .from('worker_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!workerProfile) {
      return res.status(403).json({ success: false, error: 'Only workers can rate customers.' });
    }

    const { data, error } = await supabaseAdmin
      .from('customer_ratings')
      .insert({
        booking_id: bookingId,
        worker_id: workerProfile.id,
        customer_id: customerId,
        rating,
        note: note || null,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
