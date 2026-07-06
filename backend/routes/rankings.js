// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/rankings.js — Worker Performance Rankings

import { Router } from 'express';
import { supabaseAdmin, verifyUserToken } from '../lib/supabaseAdmin.js';

const router = Router();

// Get top ranked workers by category and city
router.get('/', async (req, res) => {
  try {
    const { categoryId, country, city, rankType = 'top_rated', limit = 10 } = req.query;

    let rankingCountry = country;
    if (!rankingCountry && req.headers.authorization) {
      try {
        const user = await verifyUserToken(req.headers.authorization);
        const { data: me } = await supabaseAdmin.from('users').select('country').eq('id', user.id).single();
        rankingCountry = me?.country;
      } catch { /* fall through */ }
    }

    if (!rankingCountry) {
      return res.status(400).json({ success: false, error: 'country is required — pass it as a query param or send an auth token.' });
    }

    const baseSelect = `
      rank_position, score, rank_type, city, country,
      worker_profiles (
        id, hourly_rate, average_rating, total_jobs_done,
        verified_badge, subscription_tier, is_verified, is_available,
        users (full_name, avatar_url, city),
        worker_categories (categories (name, icon))
      )
    `;

    let data, error, scope = 'city';

    if (city) {
      // Try the exact city first
      let query = supabaseAdmin
        .from('performance_rankings')
        .select(baseSelect)
        .eq('rank_type', rankType)
        .eq('country', rankingCountry)
        .eq('city', city)
        .order('rank_position', { ascending: true })
        .limit(Number(limit));
      if (categoryId) query = query.eq('category_id', categoryId);
      ({ data, error } = await query);
      if (error) throw error;
    }

    // No city given, or that exact city has no rankings yet (too new,
    // too few workers) — fall back to the best in the whole country
    // rather than showing nothing.
    if (!data || data.length === 0) {
      scope = 'country';
      let query = supabaseAdmin
        .from('performance_rankings')
        .select(baseSelect)
        .eq('rank_type', rankType)
        .eq('country', rankingCountry)
        .order('rank_position', { ascending: true })
        .limit(Number(limit));
      if (categoryId) query = query.eq('category_id', categoryId);
      ({ data, error } = await query);
      if (error) throw error;
    }

    res.json({ success: true, data, rankType, country: rankingCountry, city: city || null, scope });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Get a worker's own ranking in their category
router.get('/my-ranking', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { data: workerProfile } = await supabaseAdmin
      .from('worker_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!workerProfile) {
      return res.status(404).json({ success: false, error: 'Worker profile not found.' });
    }

    const { data, error } = await supabaseAdmin
      .from('performance_rankings')
      .select('*, categories(name)')
      .eq('worker_id', workerProfile.id);

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Admin: Recalculate rankings for all workers (run daily via cron)
// NOTE: this duplicates backend/routes/cron.js's /calculate-rankings
// job with a simpler implementation (top_rated only). Both exist in
// the codebase today — whichever runs last wins. Fixed the same
// country/city bug here rather than remove it blind, since something
// may still call this endpoint directly, but this duplication is
// worth resolving properly later rather than maintaining two
// ranking calculators that could quietly drift apart.
router.post('/recalculate', async (req, res) => {
  try {
    // Get all categories
    const { data: categories } = await supabaseAdmin
      .from('categories')
      .select('id, name')
      .eq('is_active', true);

    let processed = 0;

    for (const category of categories || []) {
      // Get all verified workers in this category
      const { data: workers } = await supabaseAdmin
        .from('worker_profiles')
        .select(`
          id, user_id, average_rating, total_jobs_done,
          is_available, is_verified,
          users (city, country)
        `)
        .eq('is_verified', true)
        .eq('worker_categories.category_id', category.id);

      if (!workers?.length) continue;

      // Sort by rating for top_rated ranking
      const sorted = [...workers].sort((a, b) => b.average_rating - a.average_rating);

      for (let i = 0; i < sorted.length; i++) {
        const worker = sorted[i];
        // Skip workers with no recorded location rather than
        // silently mislabeling them as Ghana/Accra.
        if (!worker.users?.city || !worker.users?.country) continue;
        await supabaseAdmin
          .from('performance_rankings')
          .upsert({
            worker_id: worker.id,
            category_id: category.id,
            city: worker.users.city,
            country: worker.users.country,
            rank_type: 'top_rated',
            rank_position: i + 1,
            score: worker.average_rating,
            calculated_at: new Date().toISOString(),
          }, { onConflict: 'worker_id,category_id,rank_type' });

        processed++;
      }
    }

    res.json({ success: true, message: `Rankings recalculated. ${processed} records updated.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
