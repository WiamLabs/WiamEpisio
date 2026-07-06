// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/workers.js

import { Router } from 'express';
import { supabaseAdmin, verifyUserToken } from '../lib/supabaseAdmin.js';

const router = Router();

// Get all nearby workers
router.get('/', async (req, res) => {
  try {
    const { category, country, city, limit = 20, sort = 'rating' } = req.query;

    // Country comes from an explicit query param (public web browse)
    // or from the logged-in customer's own account (mobile app) —
    // either way it is REQUIRED and hard-filtered on. A customer in
    // one country must never see a worker based in another country,
    // no matter how the rest of the results are sorted.
    let customerCountry = country;
    if (!customerCountry && req.headers.authorization) {
      try {
        const user = await verifyUserToken(req.headers.authorization);
        const { data: me } = await supabaseAdmin.from('users').select('country').eq('id', user.id).single();
        customerCountry = me?.country;
      } catch { /* fall through — no auth, no country resolved */ }
    }

    if (!customerCountry) {
      return res.status(400).json({ error: 'country is required — pass it as a query param or send an auth token.' });
    }

    let query = supabaseAdmin
      .from('worker_profiles')
      .select(`
        id, bio, hourly_rate, currency, location_name,
        latitude, longitude, is_available, is_verified,
        verified_badge, subscription_tier, eligibility_score,
        total_jobs_done, average_rating,
        users (id, full_name, avatar_url, city, country),
        worker_categories (categories (id, name, icon))
      `)
      .eq('is_available', true)
      .eq('users.country', customerCountry)
      .limit(Number(limit) * 3); // fetch extra — city ranking below may reorder across a wider pool before trimming to the real limit

    // Real sort handling — CategoryScreen offers 5 options and
    // previously all of them silently fell back to the same
    // rating-only order regardless of which was tapped.
    switch (sort) {
      case 'jobs':      query = query.order('total_jobs_done', { ascending: false }); break;
      case 'trust':      query = query.order('eligibility_score', { ascending: false }); break;
      case 'price_asc':  query = query.order('hourly_rate', { ascending: true }); break;
      case 'online':     // resolved after merging online status below
      case 'rating':
      default:           query = query.order('average_rating', { ascending: false });
    }

    // category was previously destructured but never actually
    // applied — this is the real fix. worker_categories is a join
    // table, so we filter through it directly rather than on the
    // outer worker_profiles query.
    if (category) {
      const { data: matchIds, error: catErr } = await supabaseAdmin
        .from('worker_categories')
        .select('worker_profile_id')
        .eq('category_id', category);
      if (catErr) throw catErr;
      const ids = (matchIds || []).map((r) => r.worker_profile_id);
      if (ids.length === 0) return res.json([]);
      query = query.in('id', ids);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Merge in real online status. worker_profiles has no direct
    // FK to user_online_status for PostgREST to auto-join, so this
    // is a second batched query merged in JS rather than a fake
    // "always offline" placeholder.
    const userIds = (data || []).map((w) => w.users?.id).filter(Boolean);
    let onlineMap = {};
    if (userIds.length > 0) {
      const { data: onlineRows } = await supabaseAdmin
        .from('user_online_status')
        .select('user_id, is_online, last_seen_at')
        .in('user_id', userIds);
      onlineMap = Object.fromEntries(
        (onlineRows || []).map((r) => [r.user_id, r])
      );
    }
    let enriched = (data || []).map((w) => ({
      ...w,
      is_online: onlineMap[w.users?.id]?.is_online || false,
      last_seen_at: onlineMap[w.users?.id]?.last_seen_at || null,
    }));

    if (sort === 'online') {
      enriched = enriched.sort((a, b) => (b.is_online ? 1 : 0) - (a.is_online ? 1 : 0));
    }

    // City is a RANKING preference, never a hard filter — same-city
    // workers float to the top, but a customer whose exact city has
    // few or no workers yet still sees everyone else in their own
    // country, just ranked below. Array.sort is stable, so the sort
    // order already applied above (rating/jobs/price/online) is
    // preserved within each group.
    if (city) {
      enriched = enriched.sort((a, b) => {
        const aMatch = a.users?.city === city ? 1 : 0;
        const bMatch = b.users?.city === city ? 1 : 0;
        return bMatch - aMatch;
      });
    }

    res.json(enriched.slice(0, Number(limit)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get single worker profile
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('worker_profiles')
      .select(`
        *,
        users (id, full_name, avatar_url, city, country),
        worker_categories (categories (id, name, icon)),
        portfolio_images (id, image_url, caption),
        reviews (
          id, rating, comment, created_at,
          users!reviews_customer_id_fkey (full_name, avatar_url)
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: 'Worker not found.' });
  }
});

// Search workers
router.get('/search/:query', async (req, res) => {
  try {
    const { verifiedOnly } = req.query;
    let query = supabaseAdmin
      .from('worker_profiles')
      .select(`
        id, hourly_rate, currency, location_name,
        is_available, is_verified, average_rating, total_jobs_done,
        users (full_name, avatar_url, city),
        worker_categories (categories (name, icon))
      `)
      .order('average_rating', { ascending: false });

    if (verifiedOnly === 'true') {
      query = query.eq('is_verified', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update worker availability
router.patch('/availability', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { isAvailable } = req.body;

    const { error } = await supabaseAdmin
      .from('worker_profiles')
      .update({ is_available: isAvailable, updated_at: new Date() })
      .eq('user_id', user.id);

    if (error) throw error;
    res.json({ message: 'Availability updated.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all categories
router.get('/meta/categories', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Complete/update my own worker profile — bio + hourly rate.
// Used by the web registration flow (workers have no direct DB
// access from the browser, only the mobile app talks to Supabase
// directly) but safe for the mobile app to call too.
router.patch('/profile', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { bio, hourlyRate, currency } = req.body;

    const updates = {};
    if (bio !== undefined) updates.bio = bio;
    if (hourlyRate !== undefined) updates.hourly_rate = hourlyRate;
    if (currency !== undefined) updates.currency = currency;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }

    const { data: profile, error } = await supabaseAdmin
      .from('worker_profiles')
      .update(updates)
      .eq('user_id', user.id)
      .select().single();

    if (error) throw error;
    res.json(profile);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
