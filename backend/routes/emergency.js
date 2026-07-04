// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/emergency.js — Emergency Mode

import { Router } from 'express';
import { supabaseAdmin, verifyUserToken } from '../lib/supabaseAdmin.js';

const router = Router();

// Customer triggers emergency mode
router.post('/', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { categoryId, description, photoUrls, locationAddress, locationLat, locationLng } = req.body;

    if (!categoryId || !description || !locationAddress) {
      return res.status(400).json({ success: false, error: 'Category, description and location are required.' });
    }

    // Create emergency request — expires in 2 hours
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const { data: emergencyReq, error } = await supabaseAdmin
      .from('emergency_requests')
      .insert({
        customer_id: user.id,
        category_id: categoryId,
        description,
        photo_urls: photoUrls || [],
        location_address: locationAddress,
        location_lat: locationLat,
        location_lng: locationLng,
        status: 'open',
        expires_at: expiresAt,
        emergency_fee_pct: 0.20,
      })
      .select()
      .single();

    if (error) throw error;

    // Find all available verified workers in this category nearby
    const { data: availableWorkers } = await supabaseAdmin
      .from('worker_profiles')
      .select(`
        id, user_id,
        worker_categories!inner (category_id)
      `)
      .eq('is_available', true)
      .eq('is_verified', true)
      .eq('worker_categories.category_id', categoryId)
      .limit(20);

    // Notify all nearby workers simultaneously
    if (availableWorkers?.length > 0) {
      const workerNotifications = availableWorkers.map(w => ({
        user_id: w.user_id,
        title: '🚨 EMERGENCY JOB REQUEST',
        body: `Urgent: ${description.substring(0, 80)}... Location: ${locationAddress}. 20% emergency premium included.`,
        type: 'booking',
        data: {
          emergency: true,
          emergency_request_id: emergencyReq.id,
          category_id: categoryId,
        },
      }));

      await supabaseAdmin.from('notifications').insert(workerNotifications);
    }

    res.status(201).json({
      success: true,
      data: emergencyReq,
      workersNotified: availableWorkers?.length || 0,
      message: `Emergency request sent to ${availableWorkers?.length || 0} nearby workers. Expires in 2 hours.`,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Worker accepts emergency request (first to accept wins)
router.post('/:id/accept', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    // Get worker profile
    const { data: workerProfile } = await supabaseAdmin
      .from('worker_profiles')
      .select('id, is_verified, subscription_tier')
      .eq('user_id', user.id)
      .single();

    if (!workerProfile?.is_verified) {
      return res.status(403).json({ success: false, error: 'You must be verified to accept emergency jobs.' });
    }

    // Try to accept (race condition handled by status check)
    const { data: emergencyReq, error } = await supabaseAdmin
      .from('emergency_requests')
      .update({ status: 'accepted', accepted_by: workerProfile.id })
      .eq('id', req.params.id)
      .eq('status', 'open')  // Only accept if still open
      .select()
      .single();

    if (error || !emergencyReq) {
      return res.status(409).json({
        success: false,
        error: 'This emergency request has already been accepted by another worker.',
      });
    }

    // Get commission rate for this worker
    const { data: planConfig } = await supabaseAdmin
      .from('subscription_config')
      .select('commission_rate')
      .eq('plan_key', workerProfile.subscription_tier || 'free')
      .maybeSingle();

    const baseCommission = planConfig?.commission_rate || 0.15;
    const emergencyFee   = emergencyReq.emergency_fee_pct || 0.20;

    // Create the actual booking from the emergency request
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        customer_id:      emergencyReq.customer_id,
        worker_id:        workerProfile.id,
        worker_user_id:   user.id,
        category_id:      emergencyReq.category_id,
        description:      `EMERGENCY: ${emergencyReq.description}`,
        location_address: emergencyReq.location_address,
        location_lat:     emergencyReq.location_lat,
        location_lng:     emergencyReq.location_lng,
        status:           'accepted',
      })
      .select()
      .single();

    if (bookingError) throw bookingError;

    // Link booking to emergency request
    await supabaseAdmin
      .from('emergency_requests')
      .update({ booking_id: booking.id })
      .eq('id', emergencyReq.id);

    // Notify customer
    await supabaseAdmin.from('notifications').insert({
      user_id: emergencyReq.customer_id,
      title: 'Emergency worker found! 🚨✅',
      body: 'A verified worker has accepted your emergency request and is on the way.',
      type: 'booking',
      data: { booking_id: booking.id, emergency: true },
    });

    res.json({
      success: true,
      data: { booking, emergency: emergencyReq },
      message: 'Emergency job accepted. Customer notified.',
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Get open emergency requests (for worker home screen)
router.get('/open', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { categoryId } = req.query;

    let query = supabaseAdmin
      .from('emergency_requests')
      .select(`
        *,
        categories (name, icon),
        users!emergency_requests_customer_id_fkey (
          full_name,
          metadata
        )
      `)
      .eq('status', 'open')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (categoryId) query = query.eq('category_id', categoryId);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
