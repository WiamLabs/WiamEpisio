// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/growth.js — Job Assignment + Recurring Contracts
// (Section 21: "GROWTH AND ENTERPRISE ONLY")

import { Router } from 'express';
import { supabaseAdmin, verifyUserToken } from '../lib/supabaseAdmin.js';

const router = Router();

const PLAN_RANK = { free: 0, starter: 1, growth: 2, enterprise: 3 };

async function requireGrowthOrAbove(userId) {
  const { data: business } = await supabaseAdmin
    .from('business_profiles')
    .select('id, plan')
    .eq('user_id', userId)
    .single();

  if (!business || (PLAN_RANK[business.plan] ?? 0) < PLAN_RANK.growth) {
    const err = new Error('This feature needs a Growth plan or above. Upgrade to unlock it.');
    err.statusCode = 403;
    throw err;
  }
  return business;
}

// ============================================================
// JOB ASSIGNMENT
// ============================================================
// Reassign a booking to a different one of the business's own
// team members, instead of leaving it locked to whoever was
// originally selected. The original worker_id is who's actually
// doing the job, exactly the same as any other booking — this
// just allows a Growth+ business to change that after the fact.
router.patch('/bookings/:bookingId/assign', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const business = await requireGrowthOrAbove(user.id);
    const { workerProfileId } = req.body;

    if (!workerProfileId) {
      return res.status(400).json({ success: false, error: 'workerProfileId is required.' });
    }

    // The booking must actually belong to this business
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('id, business_id, status')
      .eq('id', req.params.bookingId)
      .eq('business_id', user.id)
      .single();

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found.' });
    }
    if (!['pending', 'accepted'].includes(booking.status)) {
      return res.status(400).json({ success: false, error: 'Only pending or accepted bookings can be reassigned.' });
    }

    // The new worker must actually be on this business's team —
    // assignment is never a way to hand a job to someone outside it
    const { data: teamMember } = await supabaseAdmin
      .from('business_team_members')
      .select('id')
      .eq('business_id', user.id)
      .eq('worker_profile_id', workerProfileId)
      .eq('status', 'active')
      .maybeSingle();

    if (!teamMember) {
      return res.status(403).json({ success: false, error: 'That worker is not an active member of your team.' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('bookings')
      .update({ worker_id: workerProfileId, assigned_by: user.id, assigned_at: new Date().toISOString() })
      .eq('id', booking.id)
      .select()
      .single();

    if (error) throw error;

    const { data: workerProfile } = await supabaseAdmin
      .from('worker_profiles').select('user_id').eq('id', workerProfileId).single();

    if (workerProfile) {
      await supabaseAdmin.from('notifications').insert({
        user_id: workerProfile.user_id,
        title: 'You were assigned a job',
        body: 'A booking has been assigned to you by your business account.',
        type: 'booking',
        data: { booking_id: booking.id },
      });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
});

// ============================================================
// RECURRING CONTRACTS
// ============================================================
router.get('/contracts', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const business = await requireGrowthOrAbove(user.id);

    const { data, error } = await supabaseAdmin
      .from('recurring_contracts')
      .select(`
        *,
        worker_profiles ( users ( full_name ) ),
        categories ( name )
      `)
      .eq('business_id', business.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
});

router.post('/contracts', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const business = await requireGrowthOrAbove(user.id);
    const { workerProfileId, categoryId, scheduleType, scheduleDays, scheduleTime, jobDescription, agreedPriceUsd } = req.body;

    if (!workerProfileId || !jobDescription) {
      return res.status(400).json({ success: false, error: 'workerProfileId and jobDescription are required.' });
    }

    const { data: teamMember } = await supabaseAdmin
      .from('business_team_members')
      .select('id')
      .eq('business_id', user.id)
      .eq('worker_profile_id', workerProfileId)
      .maybeSingle();

    if (!teamMember) {
      return res.status(403).json({ success: false, error: 'That worker is not on your team.' });
    }

    const { data, error } = await supabaseAdmin
      .from('recurring_contracts')
      .insert({
        business_id: business.id,
        worker_id: workerProfileId,
        category_id: categoryId || null,
        schedule_type: scheduleType || 'weekly',
        schedule_days: scheduleDays || [],
        schedule_time: scheduleTime || null,
        job_description: jobDescription,
        agreed_price_usd: agreedPriceUsd || null,
        status: 'active',
        starts_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    const { data: workerProfile } = await supabaseAdmin
      .from('worker_profiles').select('user_id').eq('id', workerProfileId).single();
    if (workerProfile) {
      await supabaseAdmin.from('notifications').insert({
        user_id: workerProfile.user_id,
        title: 'New recurring contract',
        body: 'A business has set up a standing arrangement with you. Check your contracts for details.',
        type: 'system',
      });
    }

    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
});

router.patch('/contracts/:id/status', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const business = await requireGrowthOrAbove(user.id);
    const { status } = req.body;

    if (!['active', 'paused', 'ended'].includes(status)) {
      return res.status(400).json({ success: false, error: 'status must be active, paused, or ended.' });
    }

    const { data, error } = await supabaseAdmin
      .from('recurring_contracts')
      .update({ status, ...(status === 'ended' ? { ends_at: new Date().toISOString() } : {}) })
      .eq('id', req.params.id)
      .eq('business_id', business.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Contract not found.' });

    res.json({ success: true, data });
  } catch (err) {
    res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
});

export default router;
