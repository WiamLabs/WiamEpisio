// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/trust.js — Trust and Follow System

import { Router } from 'express';
import { supabaseAdmin, verifyUserToken } from '../lib/supabaseAdmin.js';

const router = Router();

// ─── TRUST A WORKER ───────────────────────────────────────────

// Customer trusts a worker
router.post('/worker/:workerProfileId', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    // Customer must be verified
    const { data: customer } = await supabaseAdmin
      .from('users')
      .select('customer_verification_status')
      .eq('id', user.id)
      .single();

    if (customer?.customer_verification_status !== 'verified') {
      return res.status(403).json({
        success: false,
        error: 'You must verify your identity before trusting a worker.',
      });
    }

    // Worker must be verified
    const { data: worker } = await supabaseAdmin
      .from('worker_profiles')
      .select('id, is_verified, user_id')
      .eq('id', req.params.workerProfileId)
      .single();

    if (!worker?.is_verified) {
      return res.status(403).json({
        success: false,
        error: 'Only verified workers can receive trust.',
      });
    }

    // Insert trust record
    const { error } = await supabaseAdmin
      .from('worker_trusts')
      .insert({ customer_id: user.id, worker_id: req.params.workerProfileId });

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ success: false, error: 'You already trust this worker.' });
      }
      throw error;
    }

    // Increment trust count on worker profile
    await supabaseAdmin.rpc('increment_worker_trust', {
      p_worker_id: req.params.workerProfileId,
    });

    // Notify worker
    await supabaseAdmin.from('notifications').insert({
      user_id: worker.user_id,
      title: 'A customer trusted you! ❤️',
      body: 'Your trust count has increased. Keep delivering great work!',
      type: 'system',
      data: { worker_id: req.params.workerProfileId },
    });

    // Recalculate WiamTrust score
    await supabaseAdmin.rpc('calculate_trust_score', { p_user_id: worker.user_id });

    res.status(201).json({ success: true, message: 'Worker trusted successfully.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Customer removes trust from a worker
router.delete('/worker/:workerProfileId', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    await supabaseAdmin
      .from('worker_trusts')
      .delete()
      .eq('customer_id', user.id)
      .eq('worker_id', req.params.workerProfileId);

    // Decrement trust count
    await supabaseAdmin.rpc('decrement_worker_trust', {
      p_worker_id: req.params.workerProfileId,
    });

    const { data: worker } = await supabaseAdmin
      .from('worker_profiles')
      .select('user_id')
      .eq('id', req.params.workerProfileId)
      .single();

    if (worker) {
      await supabaseAdmin.rpc('calculate_trust_score', { p_user_id: worker.user_id });
    }

    res.json({ success: true, message: 'Trust removed.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Check if customer trusts a worker
router.get('/worker/:workerProfileId', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { data } = await supabaseAdmin
      .from('worker_trusts')
      .select('id')
      .eq('customer_id', user.id)
      .eq('worker_id', req.params.workerProfileId)
      .single();

    res.json({ success: true, data: { trusted: !!data } });
  } catch (err) {
    res.json({ success: true, data: { trusted: false } });
  }
});

// Get trust count for a worker
router.get('/worker/:workerProfileId/count', async (req, res) => {
  try {
    const { count } = await supabaseAdmin
      .from('worker_trusts')
      .select('id', { count: 'exact', head: true })
      .eq('worker_id', req.params.workerProfileId);

    res.json({ success: true, data: { count: count || 0 } });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── FOLLOW A BUSINESS ────────────────────────────────────────

// Customer follows a business
router.post('/business/:businessId', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    // Business must be verified
    const { data: business } = await supabaseAdmin
      .from('business_profiles')
      .select('id, owner_id, verification_status')
      .eq('id', req.params.businessId)
      .single();

    if (!business || business.verification_status !== 'approved') {
      return res.status(404).json({
        success: false,
        error: 'Business not found or not yet verified.',
      });
    }

    const { error } = await supabaseAdmin
      .from('business_follows')
      .insert({ customer_id: user.id, business_id: req.params.businessId });

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ success: false, error: 'Already following this business.' });
      }
      throw error;
    }

    // Increment follow count
    await supabaseAdmin.rpc('increment_business_follow', {
      p_business_id: req.params.businessId,
    });

    // Notify business owner
    await supabaseAdmin.from('notifications').insert({
      user_id: business.owner_id,
      title: 'New customer is following your business! ✅',
      body: 'Your business is growing. Keep posting great Spotlight content.',
      type: 'system',
    });

    res.status(201).json({ success: true, message: 'Now following this business.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Customer unfollows a business
router.delete('/business/:businessId', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    await supabaseAdmin
      .from('business_follows')
      .delete()
      .eq('customer_id', user.id)
      .eq('business_id', req.params.businessId);

    await supabaseAdmin.rpc('decrement_business_follow', {
      p_business_id: req.params.businessId,
    });

    res.json({ success: true, message: 'Unfollowed business.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Check if customer follows a business
router.get('/business/:businessId', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { data } = await supabaseAdmin
      .from('business_follows')
      .select('id')
      .eq('customer_id', user.id)
      .eq('business_id', req.params.businessId)
      .single();

    res.json({ success: true, data: { following: !!data } });
  } catch (err) {
    res.json({ success: true, data: { following: false } });
  }
});

// ─── CUSTOMER PROFILE DATA ────────────────────────────────────

// Get all workers a customer has trusted (Saved Workers)
router.get('/my-trusted-workers', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { data, error } = await supabaseAdmin
      .from('worker_trusts')
      .select(`
        created_at,
        worker_profiles (
          id, hourly_rate, average_rating, total_jobs_done,
          verified_badge, subscription_tier, is_verified, is_available,
          trust_count,
          users (full_name, avatar_url, city),
          worker_categories (categories (name, icon))
        )
      `)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Get all businesses a customer follows
router.get('/my-followed-businesses', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { data, error } = await supabaseAdmin
      .from('business_follows')
      .select(`
        created_at,
        business_profiles (
          id, business_name, logo_url, description,
          business_tier, verification_status,
          follow_count,
          users (full_name, city)
        )
      `)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Worker sees who trusts them (dashboard)
router.get('/my-trust-list', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { data: workerProfile } = await supabaseAdmin
      .from('worker_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!workerProfile) {
      return res.status(403).json({ success: false, error: 'Worker profile not found.' });
    }

    const { data, error } = await supabaseAdmin
      .from('worker_trusts')
      .select(`
        created_at,
        users!worker_trusts_customer_id_fkey (
          full_name, avatar_url, city
        )
      `)
      .eq('worker_id', workerProfile.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const { count } = await supabaseAdmin
      .from('worker_trusts')
      .select('id', { count: 'exact', head: true })
      .eq('worker_id', workerProfile.id);

    res.json({ success: true, data, totalTrust: count || 0 });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── CUSTOMER TRUST SCORE (visible to a worker before accepting) ──
// Answers the plan's Section-5 gap: a worker gets a job request
// from a total stranger with zero context. This gives them a
// simple 0-100 score built from the customer's own booking
// history — completed jobs raise it, cancellations and disputes
// lower it. Only summary numbers are exposed, never PII.
router.get('/customer/:customerId', async (req, res) => {
  try {
    await verifyUserToken(req.headers.authorization);

    const { data: customer, error } = await supabaseAdmin
      .from('users')
      .select('customer_trust_score, customer_completed_bookings, customer_cancelled_bookings, customer_disputes_against, created_at')
      .eq('id', req.params.customerId)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      trustScore: customer.customer_trust_score,
      completedBookings: customer.customer_completed_bookings,
      cancelledBookings: customer.customer_cancelled_bookings,
      disputesAgainst: customer.customer_disputes_against,
      memberSince: customer.created_at,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
