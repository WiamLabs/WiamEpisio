// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/admin.js — Admin Platform Control Dashboard

import { Router } from 'express';
import { supabaseAdmin, verifyUserToken } from '../lib/supabaseAdmin.js';

const router = Router();

// ─── ADMIN GUARD MIDDLEWARE ───────────────────────────────────
async function requireAdmin(req, res, next) {
  try {
    // Studio Founder proxy (server-to-server) — never expose this key to browsers
    const studioKey = process.env.STUDIO_SERVICE_KEY;
    if (studioKey && req.headers['x-studio-service-key'] === studioKey) {
      req.adminUser = {
        id: process.env.STUDIO_ACTOR_USER_ID || '00000000-0000-0000-0000-000000000001',
      };
      return next();
    }

    const user = await verifyUserToken(req.headers.authorization);
    const { data } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (data?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required.' });
    }
    req.adminUser = user;
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: 'Authentication required.' });
  }
}

router.use(requireAdmin);

// ─── PLATFORM OVERVIEW DASHBOARD ─────────────────────────────

router.get('/dashboard', async (req, res) => {
  try {
    const [
      { count: totalUsers },
      { count: totalWorkers },
      { count: totalCustomers },
      { count: totalBookings },
      { count: pendingVerifications },
      { count: openDisputes },
      { count: openFraudReports },
      { count: pendingDocReviews },
    ] = await Promise.all([
      supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'worker'),
      supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
      supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('worker_verifications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'disputed'),
      supabaseAdmin.from('fraud_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabaseAdmin.from('customer_document_reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);

    // Revenue this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: monthRevenue } = await supabaseAdmin
      .from('platform_earnings')
      .select('amount_usd')
      .gte('created_at', startOfMonth.toISOString());

    const totalMonthRevenue = monthRevenue?.reduce((sum, e) => sum + (e.amount_usd || 0), 0) || 0;

    res.json({
      success: true,
      data: {
        users: { total: totalUsers, workers: totalWorkers, customers: totalCustomers },
        bookings: { total: totalBookings, disputes: openDisputes },
        verifications: { pending: pendingVerifications, customerPending: pendingDocReviews },
        fraud: { openReports: openFraudReports },
        revenue: { thisMonth_usd: totalMonthRevenue },
        alerts: {
          urgentVerifications: (pendingVerifications || 0) > 10,
          openFraud: (openFraudReports || 0) > 0,
          activeDisputes: (openDisputes || 0) > 0,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── USER MANAGEMENT ─────────────────────────────────────────

// Search users
router.get('/users', async (req, res) => {
  try {
    const { q, role, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('users')
      .select('id, full_name, email, phone, role, is_active, is_verified, created_at, city', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
    if (role) query = query.eq('role', role);
    if (status === 'active') query = query.eq('is_active', true);
    if (status === 'suspended') query = query.eq('is_active', false);

    const { data, count, error } = await query;
    if (error) throw error;
    res.json({ success: true, data, total: count, page, limit });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Get full user profile with all details
router.get('/users/:userId', async (req, res) => {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select(`
        *,
        worker_profiles (*),
        trust_scores (*),
        verifications (verification_type, status, created_at),
        device_fingerprints (device_id, device_model, last_seen),
        audit_logs (action, created_at, metadata, ip_address)
      `)
      .eq('id', req.params.userId)
      .single();

    if (error) throw error;
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(404).json({ success: false, error: 'User not found.' });
  }
});

// Suspend a user
router.patch('/users/:userId/suspend', async (req, res) => {
  try {
    const { reason } = req.body;

    await supabaseAdmin
      .from('users')
      .update({ is_active: false })
      .eq('id', req.params.userId);

    await supabaseAdmin.from('audit_logs').insert({
      user_id: req.params.userId,
      action: 'account_suspended',
      metadata: { reason, suspended_by: req.adminUser.id },
    });

    await supabaseAdmin.from('notifications').insert({
      user_id: req.params.userId,
      title: 'Your account has been suspended',
      body: `Reason: ${reason}. Contact support@wiamapp.com to appeal.`,
      type: 'system',
    });

    res.json({ success: true, message: 'User suspended.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Reactivate a user
router.patch('/users/:userId/reactivate', async (req, res) => {
  try {
    await supabaseAdmin
      .from('users')
      .update({ is_active: true })
      .eq('id', req.params.userId);

    await supabaseAdmin.from('notifications').insert({
      user_id: req.params.userId,
      title: 'Your account has been reactivated ✅',
      body: 'You can now access WiamApp again. Welcome back.',
      type: 'system',
    });

    res.json({ success: true, message: 'User reactivated.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── DOCUMENT REVIEW QUEUE ────────────────────────────────────

// Get all pending verifications
router.get('/verification-queue', async (req, res) => {
  try {
    const { type = 'worker' } = req.query;

    if (type === 'worker') {
      // Workers submit into worker_verifications (not document_reviews)
      const { data, error } = await supabaseAdmin
        .from('worker_verifications')
        .select('*, users (full_name, email, phone, city, role)')
        .eq('status', 'pending')
        .order('submitted_at', { ascending: true });
      if (error) throw error;
      return res.json({ success: true, data, type });
    }

    const { data, error } = await supabaseAdmin
      .from('customer_document_reviews')
      .select('*, users (full_name, email, phone, city, role)')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: true });

    if (error) throw error;
    res.json({ success: true, data, type });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Get signed URL for viewing private document
router.get('/document-url/:s3Key(*)', async (req, res) => {
  try {
    const { getPrivateDocumentUrl } = await import('../lib/r2Client.js');
    const signedUrl = await getPrivateDocumentUrl(req.params.s3Key);

    // Log every document access
    await supabaseAdmin.from('audit_logs').insert({
      user_id: req.adminUser.id,
      action: 'document_viewed',
      metadata: { s3_key: req.params.s3Key, viewer: req.adminUser.id },
    });

    res.json({ success: true, data: { url: signedUrl, expiresInSeconds: 900 } });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Approve verification
router.post('/verification/approve/:reviewId', async (req, res) => {
  try {
    const { userId, type = 'worker' } = req.body;

    if (type === 'worker') {
      await supabaseAdmin
        .from('worker_verifications')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: req.adminUser.id,
        })
        .eq('id', req.params.reviewId);

      await supabaseAdmin
        .from('users')
        .update({
          is_verified: true,
          verification_status: 'approved',
          verification_reviewed_at: new Date().toISOString(),
          verification_reviewed_by: req.adminUser.id,
        })
        .eq('id', userId);

      await supabaseAdmin
        .from('worker_profiles')
        .update({ is_verified: true, verified_badge: true })
        .eq('user_id', userId);

      // Same post-approve unlocks as /api/verification/approve/:userId
      const { data: wp } = await supabaseAdmin
        .from('worker_profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      if (wp) {
        await supabaseAdmin.rpc('recalculate_profile_completion', {
          p_worker_profile_id: wp.id,
        });
      }
      try {
        const { qualifyReferral } = await import('./referrals.js');
        await qualifyReferral({ referredUserId: userId, kind: 'worker_verified' });
      } catch (refErr) {
        console.warn('qualifyReferral after Studio approve:', refErr.message);
      }
    } else {
      await supabaseAdmin
        .from('customer_document_reviews')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: req.adminUser.id,
        })
        .eq('id', req.params.reviewId);

      await supabaseAdmin
        .from('users')
        .update({
          is_verified: true,
          verification_status: 'approved',
          customer_verification_status: 'verified',
          verification_reviewed_at: new Date().toISOString(),
          verification_reviewed_by: req.adminUser.id,
        })
        .eq('id', userId);
    }

    const { sendDocumentApprovedEmail } = await import('../lib/resend.js');
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('email, full_name')
      .eq('id', userId)
      .single();

    await sendDocumentApprovedEmail(userData.email, userData.full_name);

    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      title: 'Identity verified! ✅',
      body: type === 'worker'
        ? 'Your profile is now verified. You can accept bookings!'
        : 'Your identity is verified. You can now book workers.',
      type: 'system',
    });

    res.json({ success: true, message: 'Verification approved. User notified.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Reject verification
router.post('/verification/reject/:reviewId', async (req, res) => {
  try {
    const { userId, reason, type = 'worker' } = req.body;
    if (!reason) return res.status(400).json({ success: false, error: 'Rejection reason required.' });

    if (type === 'worker') {
      await supabaseAdmin
        .from('worker_verifications')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          reviewed_at: new Date().toISOString(),
          reviewed_by: req.adminUser.id,
        })
        .eq('id', req.params.reviewId);
    } else {
      await supabaseAdmin
        .from('customer_document_reviews')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          reviewed_at: new Date().toISOString(),
          reviewed_by: req.adminUser.id,
        })
        .eq('id', req.params.reviewId);
    }

    await supabaseAdmin
      .from('users')
      .update({
        verification_status: 'rejected',
        verification_rejection_reason: reason,
        ...(type === 'customer'
          ? { customer_verification_status: 'unverified' }
          : {}),
      })
      .eq('id', userId);

    const { sendDocumentRejectedEmail } = await import('../lib/resend.js');
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('email, full_name')
      .eq('id', userId)
      .single();

    await sendDocumentRejectedEmail(userData.email, userData.full_name, reason);

    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      title: 'Action required — Verification update',
      body: `Reason: ${reason}. Please resubmit your documents.`,
      type: 'system',
    });

    res.json({ success: true, message: 'Verification rejected. User notified with reason.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── FRAUD REPORTS ────────────────────────────────────────────

router.get('/fraud-reports', async (req, res) => {
  try {
    const { status = 'open' } = req.query;

    const { data, error } = await supabaseAdmin
      .from('fraud_reports')
      .select(`
        *,
        users!fraud_reports_reported_by_fkey (full_name, email, phone),
        users!fraud_reports_reported_user_id_fkey (full_name, email, phone),
        bookings (description, location_address, scheduled_date, agreed_price)
      `)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Update fraud report status
router.patch('/fraud-reports/:id', async (req, res) => {
  try {
    const { status, adminNotes, policeReportNumber } = req.body;

    await supabaseAdmin
      .from('fraud_reports')
      .update({
        status,
        admin_notes: adminNotes,
        police_report_number: policeReportNumber,
        resolved_by: req.adminUser.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id);

    res.json({ success: true, message: 'Fraud report updated.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── COMMISSION REPORT ────────────────────────────────────────

router.get('/commission-report', async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    let startDate = new Date();
    if (period === 'week')  startDate.setDate(startDate.getDate() - 7);
    if (period === 'month') startDate.setMonth(startDate.getMonth() - 1);
    if (period === 'year')  startDate.setFullYear(startDate.getFullYear() - 1);

    const { data, error } = await supabaseAdmin
      .from('platform_earnings')
      .select('earning_type, amount_usd, currency, created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group by type
    const summary = data?.reduce((acc, e) => {
      acc[e.earning_type] = (acc[e.earning_type] || 0) + (e.amount_usd || 0);
      return acc;
    }, {});

    const total = Object.values(summary || {}).reduce((sum, v) => sum + v, 0);

    res.json({
      success: true,
      data: {
        breakdown: summary,
        total_usd: total,
        period,
        transactions: data?.length || 0,
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── SUBSCRIPTION PRICING MANAGEMENT ─────────────────────────

// Update subscription prices (founder/financial manager only)
router.put('/pricing/:planKey', async (req, res) => {
  try {
    const { priceUsd, priceUsdWeb, commissionRate } = req.body;

    const { data, error } = await supabaseAdmin
      .from('subscription_config')
      .update({
        price_usd: priceUsd,
        price_usd_web: priceUsdWeb,
        commission_rate: commissionRate,
        updated_at: new Date().toISOString(),
        updated_by: req.adminUser.id,
      })
      .eq('plan_key', req.params.planKey)
      .select()
      .single();

    if (error) throw error;

    await supabaseAdmin.from('audit_logs').insert({
      user_id: req.adminUser.id,
      action: 'pricing_updated',
      metadata: { plan_key: req.params.planKey, new_price: priceUsd, old_values: data },
    });

    res.json({ success: true, data, message: 'Pricing updated. All countries will reflect new prices.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Get all pricing config
router.get('/pricing', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('subscription_config')
      .select('*')
      .order('price_usd');

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── SOS EMERGENCY ALERTS ─────────────────────────────────────

router.get('/sos-alerts', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('worker_safety_events')
      .select(`
        *,
        users (full_name, phone, email),
        bookings (
          id,
          users!bookings_customer_id_fkey (full_name, phone),
          worker_profiles (users (full_name, phone))
        )
      `)
      .in('event_type', ['sos_worker', 'sos_customer'])
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Mark SOS as resolved
router.patch('/sos-alerts/:id/resolve', async (req, res) => {
  try {
    const { notes } = req.body;

    await supabaseAdmin
      .from('worker_safety_events')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        admin_notes: notes,
      })
      .eq('id', req.params.id);

    res.json({ success: true, message: 'SOS alert marked as resolved.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── Country availability (Studio Master God Mode) ────────────
router.get('/country-access', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_country_settings')
      .select('country_mode, open_countries')
      .eq('id', 'global')
      .maybeSingle();
    if (error) throw error;
    res.json({
      success: true,
      product: 'wiamapp',
      countryMode: data?.country_mode || 'ALL',
      openCountries: (data?.open_countries || []).map((c) => String(c).toUpperCase()),
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.patch('/country-access', async (req, res) => {
  try {
    const patch = {};
    if (req.body?.countryMode === 'ALL' || req.body?.countryMode === 'ALLOWLIST') {
      patch.country_mode = req.body.countryMode;
    }
    if (Array.isArray(req.body?.openCountries)) {
      patch.open_countries = req.body.openCountries.map((c) => String(c).toUpperCase());
    }
    if (!Object.keys(patch).length) {
      return res.status(400).json({ success: false, error: 'No country fields to update.' });
    }
    patch.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('platform_country_settings')
      .upsert({ id: 'global', ...patch }, { onConflict: 'id' })
      .select('country_mode, open_countries')
      .single();
    if (error) throw error;

    res.json({
      success: true,
      product: 'wiamapp',
      countryMode: data.country_mode,
      openCountries: (data.open_countries || []).map((c) => String(c).toUpperCase()),
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
