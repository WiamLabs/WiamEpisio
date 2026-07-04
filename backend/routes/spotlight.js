// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/spotlight.js — WiamApp Spotlight System

import { Router } from 'express';
import { supabaseAdmin, verifyUserToken } from '../lib/supabaseAdmin.js';

const router = Router();

// Get approved spotlight feed
router.get('/', async (req, res) => {
  try {
    const { categoryId, city, page = 1, limit = 20, boostedOnly } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('spotlight_posts')
      .select(`
        id, title, description, media_urls, post_type,
        is_boosted, boost_type, views_count, created_at,
        categories (name, icon, color),
        worker_profiles (
          id, average_rating, verified_badge, subscription_tier, is_verified,
          users (full_name, avatar_url, city)
        ),
        business_profiles (
          id, company_name, business_verified_gold, cover_url
        )
      `, { count: 'exact' })
      .eq('status', 'approved')
      .order('is_boosted', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (categoryId) query = query.eq('category_id', categoryId);
    if (boostedOnly === 'true') query = query.eq('is_boosted', true);

    const { data, count, error } = await query;
    if (error) throw error;

    // Increment view counts in background
    const ids = data?.map(p => p.id) || [];
    if (ids.length > 0) {
      supabaseAdmin.rpc('increment_spotlight_views', { post_ids: ids }).then(() => {});
    }

    res.json({ success: true, data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Get the authenticated user's OWN spotlight posts, at any
// moderation status — without this, a newly-submitted post would
// just vanish from the poster's own view until an admin approves
// it, which is confusing. The public feed above only ever shows
// approved posts, on purpose; this is the one place pending/
// rejected posts are visible, and only to their own author.
router.get('/mine', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { data, error } = await supabaseAdmin
      .from('spotlight_posts')
      .select(`
        id, title, description, media_urls, post_type,
        status, is_boosted, boost_type, views_count, created_at,
        categories (name, icon)
      `)
      .eq('author_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Create new spotlight post
router.post('/', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { title, description, mediaUrls, postType, categoryId } = req.body;

    // Check the poster's account type and plan — this can be either
    // an individual worker (Basic/Pro) or a Business account (any
    // paid tier), and the two live on completely different tables.
    // The previous version only ever checked worker_profiles, so a
    // Business account could never successfully post here at all.
    const { data: workerProfile } = await supabaseAdmin
      .from('worker_profiles')
      .select('id, subscription_tier, verified_badge')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: businessProfile } = await supabaseAdmin
      .from('business_profiles')
      .select('id, plan')
      .eq('user_id', user.id)
      .maybeSingle();

    const posterWorkerProfileId = workerProfile?.id || null;
    const allowedWorkerPlans = ['basic', 'pro'];
    const isAllowedWorker  = workerProfile && allowedWorkerPlans.includes(workerProfile.subscription_tier);
    const isAllowedBusiness = businessProfile && businessProfile.plan && businessProfile.plan !== 'free';

    if (!isAllowedWorker && !isAllowedBusiness) {
      return res.status(403).json({
        success: false,
        error: 'Spotlight is available for Basic, Pro, and Business subscribers only. Upgrade your plan.',
      });
    }

    if (!description && (!mediaUrls || mediaUrls.length === 0)) {
      return res.status(400).json({ success: false, error: 'Description or media required.' });
    }

    const { data, error } = await supabaseAdmin
      .from('spotlight_posts')
      .insert({
        author_id: user.id,
        worker_profile_id: isAllowedWorker ? posterWorkerProfileId : null,
        business_id: isAllowedBusiness ? businessProfile.id : null,
        category_id: categoryId,
        title,
        description,
        media_urls: mediaUrls || [],
        post_type: postType || 'portfolio',
        status: 'pending_review',
      })
      .select()
      .single();

    if (error) throw error;

    // Notify admins/moderators
    const { data: moderators } = await supabaseAdmin
      .from('users').select('id').eq('role', 'admin');

    if (moderators?.length) {
      await supabaseAdmin.from('notifications').insert(
        moderators.map(m => ({
          user_id: m.id,
          title: 'New Spotlight post for review',
          body: `${title || description?.substring(0, 50)} — awaiting moderation.`,
          type: 'system',
          data: { spotlight_post_id: data.id },
        }))
      );
    }

    res.status(201).json({
      success: true,
      data,
      message: 'Post submitted for review. It will appear after moderation (usually within 2 hours).',
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Boost a spotlight post
router.post('/:id/boost', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { boostType, paymentRef } = req.body;

    const BOOST_DAYS = { standard: 3, featured: 7, premium: 14, business: 30 };
    const BOOST_PRICES = { standard: 1.50, featured: 3.00, premium: 6.00, business: 13.00 };

    const days = BOOST_DAYS[boostType];
    if (!days) return res.status(400).json({ success: false, error: 'Invalid boost type.' });

    const boostExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from('spotlight_posts')
      .update({
        is_boosted: true,
        boost_type: boostType,
        boost_expires_at: boostExpiresAt,
        boost_paid_usd: BOOST_PRICES[boostType],
      })
      .eq('id', req.params.id)
      .eq('author_id', user.id);

    await supabaseAdmin.from('platform_earnings').insert({
      earning_type: 'spotlight_boost',
      amount_usd: BOOST_PRICES[boostType],
      currency: 'USD',
    });

    res.json({
      success: true,
      message: `Post boosted for ${days} days. It will appear in featured areas.`,
      expiresAt: boostExpiresAt,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Report a post
router.post('/:id/report', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { reason } = req.body;

    if (!reason) return res.status(400).json({ success: false, error: 'Reason required.' });

    await supabaseAdmin.from('spotlight_reports').insert({
      post_id: req.params.id,
      reporter_id: user.id,
      reason,
    });

    // Increment report count
    await supabaseAdmin.rpc('increment_report_count', { post_id: req.params.id });

    res.json({ success: true, message: 'Report submitted. Our team will review it.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Admin: Approve post
router.patch('/admin/:id/approve', async (req, res) => {
  try {
    await supabaseAdmin
      .from('spotlight_posts')
      .update({ status: 'approved' })
      .eq('id', req.params.id);

    const { data: post } = await supabaseAdmin
      .from('spotlight_posts')
      .select('author_id')
      .eq('id', req.params.id)
      .single();

    await supabaseAdmin.from('notifications').insert({
      user_id: post.author_id,
      title: 'Spotlight post approved ✅',
      body: 'Your post is now live and visible to customers.',
      type: 'system',
    });

    res.json({ success: true, message: 'Post approved and published.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Admin: Reject post
router.patch('/admin/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, error: 'Rejection reason required.' });

    await supabaseAdmin
      .from('spotlight_posts')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', req.params.id);

    const { data: post } = await supabaseAdmin
      .from('spotlight_posts')
      .select('author_id')
      .eq('id', req.params.id)
      .single();

    await supabaseAdmin.from('notifications').insert({
      user_id: post.author_id,
      title: 'Spotlight post not approved',
      body: `Reason: ${reason}. Please review our content guidelines and repost.`,
      type: 'system',
    });

    res.json({ success: true, message: 'Post rejected. Author notified.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
