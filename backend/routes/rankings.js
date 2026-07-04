// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/rankings.js — Worker Performance Rankings

import { Router } from 'express';
import { supabaseAdmin, verifyUserToken } from '../lib/supabaseAdmin.js';

const router = Router();

// Get top ranked workers by category and city
router.get('/', async (req, res) => {
  try {
    const { categoryId, city = 'Accra', rankType = 'top_rated', limit = 10 } = req.query;

    let query = supabaseAdmin
      .from('performance_rankings')
      .select(`
        rank_position, score, rank_type,
        worker_profiles (
          id, hourly_rate, average_rating, total_jobs_done,
          verified_badge, subscription_tier, is_verified, is_available,
          users (full_name, avatar_url, city),
          worker_categories (categories (name, icon))
        )
      `)
      .eq('rank_type', rankType)
      .eq('city', city)
      .order('rank_position', { ascending: true })
      .limit(Number(limit));

    if (categoryId) query = query.eq('category_id', categoryId);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data, rankType, city });
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
          users (city)
        `)
        .eq('is_verified', true)
        .eq('worker_categories.category_id', category.id);

      if (!workers?.length) continue;

      // Sort by rating for top_rated ranking
      const sorted = [...workers].sort((a, b) => b.average_rating - a.average_rating);

      for (let i = 0; i < sorted.length; i++) {
        const worker = sorted[i];
        await supabaseAdmin
          .from('performance_rankings')
          .upsert({
            worker_id: worker.id,
            category_id: category.id,
            city: worker.users?.city || 'Accra',
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
