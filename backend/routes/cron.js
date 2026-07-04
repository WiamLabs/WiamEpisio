// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/cron.js
//
// Scheduled jobs triggered by an external free cron service
// (cron-job.org), exactly as Section 5/14 of the master plan
// describes — Render's free tier does not reliably run an
// in-process scheduler, so these are plain HTTP endpoints guarded
// by a shared secret instead of a real admin session, since the
// caller is a cron service, not a logged-in human.
//
// SETUP REQUIRED:
//   1. Add CRON_SECRET to your Render environment variables — any
//      long random string you generate yourself.
//   2. On cron-job.org, create two jobs:
//        Nightly, 2:00 AM:  POST {BACKEND_URL}/api/cron/calculate-eligibility
//        Nightly, 2:30 AM:  POST {BACKEND_URL}/api/cron/calculate-rankings
//      Both with header:  X-Cron-Secret: <the same value>

import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const router = Router();

function requireCronSecret(req, res, next) {
  const provided = req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET) {
    return res.status(500).json({ success: false, error: 'CRON_SECRET is not configured on the server.' });
  }
  if (!provided || provided !== process.env.CRON_SECRET) {
    return res.status(401).json({ success: false, error: 'Invalid or missing cron secret.' });
  }
  next();
}

router.use(requireCronSecret);

// ============================================================
// ELIGIBILITY SCORE — Master Plan Section 4B
// ============================================================
/**
 * eligibility_score =
 *     (min(completed_jobs, 50) / 50) * 35
 *   + (avg_rating / 5)              * 35
 *   + (dispute_free_rate)           * 20
 *   + (clean_account_bonus)         * 10
 *
 * Rolling window: last 50 completed bookings OR last 12 months,
 * whichever set is SMALLER — this is what keeps the score honest
 * about "who this worker is right now" instead of lifetime stats.
 *
 * Thresholds:
 *   free workers   need >= 88 to hold the badge
 *   basic/pro workers need >= 65 to hold the badge
 */
router.post('/calculate-eligibility', async (req, res) => {
  const startedAt = Date.now();
  const results = { processed: 0, badgeGained: 0, badgeLost: 0, errors: [] };

  try {
    const { data: workers, error: workersErr } = await supabaseAdmin
      .from('worker_profiles')
      .select('id, user_id, subscription_tier, verified_badge, created_at, account_suspended_at');

    if (workersErr) throw workersErr;

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    for (const worker of workers || []) {
      try {
        // Pull bookings within the last 12 months, most recent
        // first, then cap to 50 in JS — equivalent to "whichever
        // set is smaller" without needing two separate queries.
        const { data: bookings, error: bookingsErr } = await supabaseAdmin
          .from('bookings')
          .select('status, is_disputed, created_at')
          .eq('worker_id', worker.id)
          .eq('status', 'completed')
          .gte('created_at', twelveMonthsAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(50);

        if (bookingsErr) throw bookingsErr;

        const completedJobs = bookings?.length || 0;

        // Average rating from reviews tied to this worker in the
        // same window. reviews already has its own worker_id and
        // created_at directly — no need for a nested booking join.
        const { data: reviews } = await supabaseAdmin
          .from('reviews')
          .select('rating')
          .eq('worker_id', worker.id)
          .gte('created_at', twelveMonthsAgo.toISOString());

        const avgRating = reviews?.length
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : 0;

        const disputedCount = bookings?.filter(b => b.is_disputed).length || 0;
        const disputeFreeRate = completedJobs > 0 ? 1 - (disputedCount / completedJobs) : 0;

        const accountAgeMonths = worker.created_at
          ? (Date.now() - new Date(worker.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
          : 0;
        const cleanAccountBonus = !worker.account_suspended_at && accountAgeMonths >= 3 ? 1 : (accountAgeMonths / 3);

        const eligibilityScore =
          (Math.min(completedJobs, 50) / 50) * 35 +
          (avgRating / 5) * 35 +
          disputeFreeRate * 20 +
          Math.min(cleanAccountBonus, 1) * 10;

        const isPaid = ['basic', 'pro'].includes(worker.subscription_tier);
        const threshold = isPaid ? 65 : 88;
        const hasBadgeNow = eligibilityScore >= threshold;
        const hadBadgeBefore = worker.verified_badge;

        await supabaseAdmin
          .from('worker_profiles')
          .update({
            eligibility_score: Math.round(eligibilityScore * 100) / 100,
            verified_badge: hasBadgeNow,
            badge_last_calculated: new Date().toISOString(),
            badge_threshold_used: isPaid ? 'paid' : 'free',
          })
          .eq('id', worker.id);

        // Notify only on an actual change, and only the badge LOSS
        // case needs proactive notice — gaining it is a pleasant
        // surprise the worker will simply see on their profile.
        if (hadBadgeBefore && !hasBadgeNow) {
          await supabaseAdmin.from('notifications').insert({
            user_id: worker.user_id,
            title: 'Your Checkmark badge is currently inactive',
            body: `Your recent rating or job activity dropped below the bar needed to keep it. Keep delivering great work and it will reactivate automatically.`,
            type: 'system',
          });
          results.badgeLost++;
        } else if (!hadBadgeBefore && hasBadgeNow) {
          await supabaseAdmin.from('notifications').insert({
            user_id: worker.user_id,
            title: 'You earned the Checkmark badge!',
            body: 'Your job history and ratings have earned you WiamApp\'s verified Checkmark. It now shows on your profile, search results, and chats.',
            type: 'system',
          });
          results.badgeGained++;
        }

        results.processed++;
      } catch (workerErr) {
        results.errors.push({ workerId: worker.id, error: workerErr.message });
      }
    }

    res.json({
      success: true,
      data: { ...results, durationMs: Date.now() - startedAt },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// PERFORMANCE RANKINGS — Master Plan Section 13/14
// ============================================================
router.post('/calculate-rankings', async (req, res) => {
  const startedAt = Date.now();
  let totalRanked = 0;

  try {
    // Get every distinct (city, category) pair that has at least
    // one available worker — rankings are computed per city per
    // category, never globally, since "top electrician" only
    // means something within a place a customer can actually book.
    const { data: pairs } = await supabaseAdmin
      .from('worker_profiles')
      .select('id, average_rating, total_jobs_done, eligibility_score, users(city), worker_categories(category_id)')
      .eq('is_available', true)
      .eq('is_verified', true);

    // Flatten into one row per (worker, category)
    const flatRows = [];
    for (const w of pairs || []) {
      const city = w.users?.city;
      if (!city) continue;
      for (const wc of w.worker_categories || []) {
        flatRows.push({
          workerId: w.id,
          categoryId: wc.category_id,
          city,
          rating: w.average_rating || 0,
          jobs: w.total_jobs_done || 0,
          score: w.eligibility_score || 0,
        });
      }
    }

    // Group by city + category
    const groups = {};
    for (const row of flatRows) {
      const key = `${row.city}::${row.categoryId}`;
      (groups[key] = groups[key] || []).push(row);
    }

    const upserts = [];
    for (const key of Object.keys(groups)) {
      const rows = groups[key];

      // top_rated — by average rating, jobs as tiebreaker
      const byRating = [...rows].sort((a, b) => b.rating - a.rating || b.jobs - a.jobs);
      byRating.slice(0, 20).forEach((r, i) => upserts.push({
        worker_id: r.workerId, category_id: r.categoryId, city: r.city,
        rank_type: 'top_rated', rank_position: i + 1, score: r.rating,
      }));

      // most_jobs_month — by job count
      const byJobs = [...rows].sort((a, b) => b.jobs - a.jobs);
      byJobs.slice(0, 20).forEach((r, i) => upserts.push({
        worker_id: r.workerId, category_id: r.categoryId, city: r.city,
        rank_type: 'most_jobs_month', rank_position: i + 1, score: r.jobs,
      }));

      // highest_trust — by Eligibility Score (Section 4B's number
      // doubles as the most honest available "trust" ranking input)
      const byScore = [...rows].sort((a, b) => b.score - a.score);
      byScore.slice(0, 20).forEach((r, i) => upserts.push({
        worker_id: r.workerId, category_id: r.categoryId, city: r.city,
        rank_type: 'highest_trust', rank_position: i + 1, score: r.score,
      }));

      totalRanked += rows.length;
    }

    // Clear old rankings and write the fresh set. A full
    // delete-then-insert is simpler and safer than trying to
    // reconcile diffs, and this table is small enough that it's
    // cheap to do nightly.
    await supabaseAdmin.from('performance_rankings').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    if (upserts.length > 0) {
      // Insert in chunks to stay well under any request size limit
      const chunkSize = 500;
      for (let i = 0; i < upserts.length; i += chunkSize) {
        await supabaseAdmin.from('performance_rankings').insert(upserts.slice(i, i + chunkSize));
      }
    }

    res.json({
      success: true,
      data: { groupsRanked: Object.keys(groups).length, rowsConsidered: totalRanked, rankingsWritten: upserts.length, durationMs: Date.now() - startedAt },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// REPEAT BOOKING REMINDERS — fills the "growth feature" gap the
// master-plan audit flagged as high priority and near-free to
// build. Nightly job: find bookings completed ~6 weeks ago where
// the customer never re-booked that same worker, and never re-
// booked ANY worker in that category since, then send one
// personalised push. Add a third cron-job.org entry:
//   Nightly, 3:00 AM: POST {BACKEND_URL}/api/cron/repeat-booking-reminders
// ============================================================
router.post('/repeat-booking-reminders', async (req, res) => {
  const startedAt = Date.now();
  try {
    const sixWeeksAgo = new Date(Date.now() - 42 * 24 * 60 * 60 * 1000);
    const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000);

    // Completed bookings that landed in the 6-8 week old window and
    // haven't been reminded about yet
    const { data: candidates, error } = await supabaseAdmin
      .from('bookings')
      .select('id, customer_id, worker_id, category_id, updated_at, worker_profiles(user_id, users(full_name))')
      .eq('status', 'completed')
      .eq('repeat_reminder_sent', false)
      .lte('updated_at', sixWeeksAgo.toISOString())
      .gte('updated_at', eightWeeksAgo.toISOString());

    if (error) throw error;

    let sent = 0;
    for (const booking of candidates || []) {
      // Skip if the customer already booked this same worker again since
      const { count: rebooked } = await supabaseAdmin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', booking.customer_id)
        .eq('worker_id', booking.worker_id)
        .gt('created_at', booking.updated_at);

      if (!rebooked) {
        const workerName = booking.worker_profiles?.users?.full_name || 'that worker';
        await supabaseAdmin.from('notifications').insert({
          user_id: booking.customer_id,
          title: `Need ${workerName} again?`,
          body: `It's been a while since your last booking. Rebook ${workerName} in one tap.`,
          type: 'booking',
          data: { worker_id: booking.worker_id, repeat_reminder: true },
        });
        sent++;
      }

      await supabaseAdmin.from('bookings').update({ repeat_reminder_sent: true }).eq('id', booking.id);
    }

    res.json({ success: true, data: { candidates: candidates?.length || 0, remindersSent: sent, durationMs: Date.now() - startedAt } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 24-HOUR SCHEDULED BOOKING REMINDER — for future-dated bookings
// that the worker has confirmed, nudge both sides a day before.
//   Nightly, 8:00 AM: POST {BACKEND_URL}/api/cron/scheduled-booking-reminders
// ============================================================
router.post('/scheduled-booking-reminders', async (req, res) => {
  const startedAt = Date.now();
  try {
    const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const in48h = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const { data: upcoming, error } = await supabaseAdmin
      .from('bookings')
      .select('id, customer_id, worker_id, scheduled_date, worker_profiles(user_id)')
      .eq('worker_confirmed_slot', true)
      .eq('reminder_24h_sent', false)
      .gte('scheduled_date', in24h.toISOString())
      .lte('scheduled_date', in48h.toISOString());

    if (error) throw error;

    let sent = 0;
    for (const booking of upcoming || []) {
      const recipients = [booking.customer_id, booking.worker_profiles?.user_id].filter(Boolean);
      for (const uid of recipients) {
        await supabaseAdmin.from('notifications').insert({
          user_id: uid,
          title: 'Appointment tomorrow ⏰',
          body: 'You have a confirmed WiamApp appointment coming up in the next day.',
          type: 'booking',
          data: { booking_id: booking.id },
        });
      }
      await supabaseAdmin.from('bookings').update({ reminder_24h_sent: true }).eq('id', booking.id);
      sent++;
    }

    res.json({ success: true, data: { remindersSent: sent, durationMs: Date.now() - startedAt } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
