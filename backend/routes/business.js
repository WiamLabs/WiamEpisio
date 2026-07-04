// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/business.js — Business Account Management

import { Router } from 'express';
import { supabaseAdmin, verifyUserToken } from '../lib/supabaseAdmin.js';

const router = Router();

// Team size limit per plan — single source of truth, never stored
// as a separate column so it can never drift out of sync with the
// real plan on the row.
const MAX_WORKERS_BY_PLAN = { free: 0, starter: 5, growth: 25, enterprise: 9999 };

// Apply for Business Account
router.post('/apply', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const {
      plan, companyName, contactName, email, phone, industry, teamSize,
      registrationDocUrl, tinDocUrl,
    } = req.body;

    if (!companyName || !contactName || !email || !phone) {
      return res.status(400).json({ success: false, error: 'Company name, contact name, email and phone are required.' });
    }

    const { data, error } = await supabaseAdmin
      .from('business_profiles')
      .upsert({
        user_id: user.id,
        company_name: companyName,
        contact_name: contactName,
        contact_phone: phone,
        industry: industry || null,
        requested_team_size: teamSize ? parseInt(teamSize, 10) : null,
        plan: plan || 'starter',
        registration_doc_url: registrationDocUrl || null,
        tin_doc_url: tinDocUrl || null,
        business_verified_gold: false,
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;

    // Without this, an applicant's users.role stays whatever it was
    // at signup (almost always 'customer') forever — the web
    // portal's login gate checks role === 'business' specifically,
    // so a real, approved business could never actually log in to
    // their own dashboard without this update. Role changes
    // immediately on application, not gated behind Gold approval —
    // Section 8B already establishes that a business gets full
    // functional access right away, with Gold being a separate,
    // later, manually-reviewed trust signal layered on top.
    await supabaseAdmin
      .from('users')
      .update({ role: 'business' })
      .eq('id', user.id);

    // Notify admins
    const { data: admins } = await supabaseAdmin
      .from('users').select('id').eq('role', 'admin');

    if (admins?.length) {
      await supabaseAdmin.from('notifications').insert(
        admins.map(a => ({
          user_id: a.id,
          title: 'New business account application',
          body: `${companyName} has applied for a Business account. Review their documents within 24-48 hours.`,
          type: 'system',
          data: { business_id: data.id },
        }))
      );
    }

    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'business_application_submitted',
      metadata: { business_id: data.id, company_name: companyName, plan },
    });

    res.status(201).json({
      success: true,
      data,
      message: 'Application submitted. Document review takes 24-48 hours. You will be notified when your Gold checkmark is approved.',
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Get business profile
router.get('/profile', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { data, error } = await supabaseAdmin
      .from('business_profiles')
      .select(`
        *,
        business_team_members (
          id, role, status, is_hidden_from_search, joined_at,
          worker_profiles (
            id, average_rating, total_jobs_done, is_available,
            verified_badge, subscription_tier,
            users (full_name, avatar_url, phone)
          )
        )
      `)
      .eq('user_id', user.id)
      .single();

    if (error) throw error;
    res.json({
      success: true,
      data: { ...data, max_workers: MAX_WORKERS_BY_PLAN[data.plan] ?? 5 },
    });
  } catch (err) {
    res.status(404).json({ success: false, error: 'Business profile not found.' });
  }
});

// Get business analytics
router.get('/analytics', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { data: business } = await supabaseAdmin
      .from('business_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!business) {
      return res.status(404).json({ success: false, error: 'Business profile not found.' });
    }

    // Get team member worker_profile IDs
    const { data: teamMembers } = await supabaseAdmin
      .from('business_team_members')
      .select('worker_profile_id')
      .eq('business_id', user.id);

    const workerProfileIds = teamMembers?.map(m => m.worker_profile_id) || [];

    // Get booking stats for all team workers. bookings.worker_id
    // references worker_profiles(id) — same id space as
    // worker_profile_id above, so this join is correct as-is.
    const { data: bookings } = workerProfileIds.length
      ? await supabaseAdmin
          .from('bookings')
          .select('status, agreed_price, currency, created_at')
          .in('worker_id', workerProfileIds)
      : { data: [] };

    const completed = bookings?.filter(b => b.status === 'completed') || [];
    const totalRevenue = completed.reduce((sum, b) => sum + parseFloat(b.agreed_price || 0), 0);

    // Group by month
    const byMonth = completed.reduce((acc, b) => {
      const month = b.created_at?.substring(0, 7);
      acc[month] = (acc[month] || 0) + parseFloat(b.agreed_price || 0);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        totalWorkers: workerProfileIds.length,
        totalBookings: bookings?.length || 0,
        completedJobs: completed.length,
        totalRevenue,
        revenueByMonth: byMonth,
        cancellationRate: bookings?.length
          ? Number((bookings.filter(b => b.status === 'cancelled').length / bookings.length * 100).toFixed(1))
          : 0,
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Add worker to business team
router.post('/team/add', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { workerUserId, role = 'Team Member' } = req.body;

    const { data: business } = await supabaseAdmin
      .from('business_profiles')
      .select('plan')
      .eq('user_id', user.id)
      .single();

    if (!business) {
      return res.status(403).json({ success: false, error: 'Business account required.' });
    }

    // Check team size limit
    const { count: currentTeamSize } = await supabaseAdmin
      .from('business_team_members')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', user.id);

    const maxWorkers = MAX_WORKERS_BY_PLAN[business.plan] ?? 5;
    if ((currentTeamSize || 0) >= maxWorkers) {
      return res.status(403).json({
        success: false,
        error: `Your ${business.plan} plan allows up to ${maxWorkers} workers. Upgrade to add more.`,
      });
    }

    const { data: workerProfile } = await supabaseAdmin
      .from('worker_profiles')
      .select('id')
      .eq('user_id', workerUserId)
      .single();

    if (!workerProfile) {
      return res.status(404).json({ success: false, error: 'Worker profile not found.' });
    }

    const { data, error } = await supabaseAdmin
      .from('business_team_members')
      .insert({ business_id: user.id, worker_profile_id: workerProfile.id, role })
      .select()
      .single();

    if (error) throw error;

    await supabaseAdmin.from('notifications').insert({
      user_id: workerUserId,
      title: 'You joined a business team',
      body: 'You have been added to a business account on WiamApp.',
      type: 'system',
    });

    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Remove worker from team
router.delete('/team/:workerProfileId', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { data: business } = await supabaseAdmin
      .from('business_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!business) {
      return res.status(403).json({ success: false, error: 'Business account required.' });
    }

    await supabaseAdmin
      .from('business_team_members')
      .delete()
      .eq('business_id', user.id)
      .eq('worker_profile_id', req.params.workerProfileId);

    res.json({ success: true, message: 'Worker removed from team.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Toggle a team member's "hide from public search" status (Section 17B)
router.patch('/team/:workerProfileId/visibility', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { hidden } = req.body;

    const { data: business } = await supabaseAdmin
      .from('business_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!business) {
      return res.status(403).json({ success: false, error: 'Business account required.' });
    }

    const { data, error } = await supabaseAdmin
      .from('business_team_members')
      .update({ is_hidden_from_search: !!hidden })
      .eq('business_id', user.id)
      .eq('worker_profile_id', req.params.workerProfileId)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
