// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/quotes.js — Instant Quote System

import { Router } from 'express';
import { supabaseAdmin, verifyUserToken } from '../lib/supabaseAdmin.js';

const router = Router();

// Customer posts a job for quotes
router.post('/', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const {
      categoryId, title, description, photoUrls,
      locationAddress, preferredDate, budgetMinUsd, budgetMaxUsd,
    } = req.body;

    if (!categoryId || !description) {
      return res.status(400).json({ success: false, error: 'Category and description required.' });
    }

    // Expires in 2 hours
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from('quote_requests')
      .insert({
        customer_id: user.id,
        category_id: categoryId,
        title,
        description,
        photo_urls: photoUrls || [],
        location_address: locationAddress,
        preferred_date: preferredDate,
        budget_min_usd: budgetMinUsd,
        budget_max_usd: budgetMaxUsd,
        status: 'open',
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) throw error;

    // Notify nearby verified workers in this category
    const { data: workers } = await supabaseAdmin
      .from('worker_profiles')
      .select('user_id, worker_categories!inner(category_id)')
      .eq('is_available', true)
      .eq('is_verified', true)
      .eq('worker_categories.category_id', categoryId)
      .limit(30);

    if (workers?.length > 0) {
      await supabaseAdmin.from('notifications').insert(
        workers.map(w => ({
          user_id: w.user_id,
          title: 'New Quote Request',
          body: `${title || description.substring(0, 60)}... Send your best quote now.`,
          type: 'booking',
          data: { quote_request_id: data.id },
        }))
      );
    }

    res.status(201).json({ success: true, data, workersNotified: workers?.length || 0 });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Worker submits a quote
router.post('/:requestId/submit', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { priceUsd, timeline, message, availability } = req.body;

    if (!priceUsd) {
      return res.status(400).json({ success: false, error: 'Price is required.' });
    }

    const { data: workerProfile } = await supabaseAdmin
      .from('worker_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!workerProfile) {
      return res.status(403).json({ success: false, error: 'Only workers can submit quotes.' });
    }

    // Check request is still open
    const { data: request } = await supabaseAdmin
      .from('quote_requests')
      .select('*')
      .eq('id', req.params.requestId)
      .eq('status', 'open')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!request) {
      return res.status(404).json({ success: false, error: 'Quote request is closed or expired.' });
    }

    const { data, error } = await supabaseAdmin
      .from('quotes')
      .insert({
        request_id: req.params.requestId,
        worker_id: workerProfile.id,
        price_usd: priceUsd,
        timeline,
        message,
        availability,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Notify customer of new quote
    const { data: workerUser } = await supabaseAdmin
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .single();

    await supabaseAdmin.from('notifications').insert({
      user_id: request.customer_id,
      title: `New quote from ${workerUser?.full_name}`,
      body: `They quoted $${priceUsd} for your job. Tap to review all quotes.`,
      type: 'booking',
      data: { quote_request_id: req.params.requestId, quote_id: data.id },
    });

    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Customer selects a quote → creates booking
router.post('/:requestId/select/:quoteId', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { data: quote } = await supabaseAdmin
      .from('quotes')
      .select(`*, worker_profiles(id, user_id)`)
      .eq('id', req.params.quoteId)
      .eq('request_id', req.params.requestId)
      .single();

    if (!quote) {
      return res.status(404).json({ success: false, error: 'Quote not found.' });
    }

    const { data: request } = await supabaseAdmin
      .from('quote_requests')
      .select('*')
      .eq('id', req.params.requestId)
      .eq('customer_id', user.id)
      .single();

    if (!request) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    // Create booking from the selected quote
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .insert({
        customer_id: user.id,
        worker_id: quote.worker_profiles.id,
        worker_user_id: quote.worker_profiles.user_id,
        category_id: request.category_id,
        description: request.description,
        scheduled_date: request.preferred_date,
        location_address: request.location_address,
        agreed_price: quote.price_usd,
        currency: 'USD',
        status: 'accepted',
      })
      .select()
      .single();

    if (error) throw error;

    // Update quote and request status
    await supabaseAdmin.from('quotes').update({ status: 'selected' }).eq('id', quote.id);
    await supabaseAdmin.from('quote_requests').update({
      status: 'closed',
      selected_quote_id: quote.id,
    }).eq('id', request.id);

    // Reject all other quotes
    await supabaseAdmin.from('quotes')
      .update({ status: 'rejected' })
      .eq('request_id', request.id)
      .neq('id', quote.id);

    // Notify selected worker
    await supabaseAdmin.from('notifications').insert({
      user_id: quote.worker_profiles.user_id,
      title: 'Your quote was selected!',
      body: 'The customer chose your quote. Complete payment to start the job.',
      type: 'booking',
      data: { booking_id: booking.id },
    });

    res.json({ success: true, data: { booking, quote } });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Get a single quote request's own details (job title/description/
// budget for the header of QuotesListScreen). This endpoint did not
// exist before — the screen was calling a URL that doesn't match
// any route at all.
router.get('/:requestId', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('quote_requests')
      .select(`*, categories(name, icon)`)
      .eq('id', req.params.requestId)
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(404).json({ success: false, error: 'Quote request not found.' });
  }
});

// Get all quotes for a request (customer view)
router.get('/:requestId/quotes', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { data, error } = await supabaseAdmin
      .from('quotes')
      .select(`
        *,
        worker_profiles (
          id, hourly_rate, average_rating, total_jobs_done,
          verified_badge, subscription_tier, is_verified,
          users (id, full_name, avatar_url, city)
        )
      `)
      .eq('request_id', req.params.requestId)
      .order('price_usd', { ascending: true });

    if (error) throw error;

    // Merge in real online status, same pattern as workers.js —
    // no fake "always offline" placeholder.
    const userIds = (data || [])
      .map((q) => q.worker_profiles?.users?.id)
      .filter(Boolean);
    let onlineMap = {};
    if (userIds.length > 0) {
      const { data: onlineRows } = await supabaseAdmin
        .from('user_online_status')
        .select('user_id, is_online')
        .in('user_id', userIds);
      onlineMap = Object.fromEntries((onlineRows || []).map((r) => [r.user_id, r.is_online]));
    }
    const enriched = (data || []).map((q) => ({
      ...q,
      is_online: onlineMap[q.worker_profiles?.users?.id] || false,
    }));

    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Get customer's open quote requests
router.get('/my-requests', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { data, error } = await supabaseAdmin
      .from('quote_requests')
      .select(`*, categories(name, icon)`)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
