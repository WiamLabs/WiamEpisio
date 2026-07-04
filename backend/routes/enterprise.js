// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/enterprise.js — Multi-Location, Vendor Database,
// SLA Dashboard, Invoicing (Section 21: "ENTERPRISE ONLY")

import { Router } from 'express';
import { supabaseAdmin, verifyUserToken } from '../lib/supabaseAdmin.js';

const router = Router();

async function requireEnterprise(userId) {
  const { data: business } = await supabaseAdmin
    .from('business_profiles')
    .select('id, plan')
    .eq('user_id', userId)
    .single();

  if (!business || business.plan !== 'enterprise') {
    const err = new Error('This feature is Enterprise plan only. Upgrade to unlock it.');
    err.statusCode = 403;
    throw err;
  }
  return business;
}

// ============================================================
// MULTI-LOCATION
// ============================================================
router.get('/locations', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const business = await requireEnterprise(user.id);

    const { data, error } = await supabaseAdmin
      .from('enterprise_locations')
      .select('*, manager:manager_user_id ( full_name )')
      .eq('enterprise_id', business.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
});

router.post('/locations', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const business = await requireEnterprise(user.id);
    const { locationName, locationCode, city, address, spendingLimitUsd } = req.body;

    if (!locationName) {
      return res.status(400).json({ success: false, error: 'locationName is required.' });
    }

    const { data, error } = await supabaseAdmin
      .from('enterprise_locations')
      .insert({
        enterprise_id: business.id,
        location_name: locationName,
        location_code: locationCode || null,
        city: city || null,
        address: address || null,
        spending_limit_usd: spendingLimitUsd || null,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
});

// ============================================================
// VENDOR DATABASE
// ============================================================
router.get('/vendors', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const business = await requireEnterprise(user.id);

    const { data, error } = await supabaseAdmin
      .from('enterprise_vendors')
      .select(`
        *,
        worker_profiles ( id, average_rating, total_jobs_done, verified_badge, users ( full_name, avatar_url, phone ) )
      `)
      .eq('enterprise_id', business.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
});

router.post('/vendors', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const business = await requireEnterprise(user.id);
    const { workerProfileId, notes } = req.body;

    if (!workerProfileId) {
      return res.status(400).json({ success: false, error: 'workerProfileId is required.' });
    }

    const { data, error } = await supabaseAdmin
      .from('enterprise_vendors')
      .insert({ enterprise_id: business.id, worker_id: workerProfileId, added_by: user.id, notes: notes || null })
      .select()
      .single();

    if (error) throw error;

    const { data: workerProfile } = await supabaseAdmin
      .from('worker_profiles').select('user_id').eq('id', workerProfileId).single();
    if (workerProfile) {
      await supabaseAdmin.from('notifications').insert({
        user_id: workerProfile.user_id,
        title: 'Added to a preferred vendor list',
        body: 'An Enterprise business has added you to their verified vendor database.',
        type: 'system',
      });
    }

    res.status(201).json({ success: true, data });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'That worker is already in your vendor database.' });
    }
    res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
});

// ============================================================
// SLA DASHBOARD
// ============================================================
router.get('/sla', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const business = await requireEnterprise(user.id);

    const [{ data: contracts }, { data: breaches }] = await Promise.all([
      supabaseAdmin.from('sla_contracts').select('*').eq('enterprise_id', business.id).eq('is_active', true),
      supabaseAdmin
        .from('sla_breach_log')
        .select('*, bookings ( id, scheduled_date )')
        .eq('enterprise_id', business.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    res.json({ success: true, data: { contracts: contracts || [], breaches: breaches || [] } });
  } catch (err) {
    res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
});

// ============================================================
// INVOICING
// ============================================================
router.get('/invoices', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const business = await requireEnterprise(user.id);

    const { data, error } = await supabaseAdmin
      .from('enterprise_invoices')
      .select('*')
      .eq('enterprise_id', business.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
});

export default router;
