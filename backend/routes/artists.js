// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/artists.js — Musician Pro public + artist tools API

import { Router } from 'express';
import { supabaseAdmin, verifyUserToken } from '../lib/supabaseAdmin.js';

const router = Router();

function normalizeHandle(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 40);
}

async function getWorkerProfileId(userId) {
  const { data, error } = await supabaseAdmin
    .from('worker_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

async function getMyArtist(userId) {
  const workerProfileId = await getWorkerProfileId(userId);
  if (!workerProfileId) return null;
  const { data, error } = await supabaseAdmin
    .from('artist_profiles')
    .select('*')
    .eq('worker_profile_id', workerProfileId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── PUBLIC: GET /api/artists/by-handle/:handle ───────────────
router.get('/by-handle/:handle', async (req, res) => {
  try {
    const handle = normalizeHandle(req.params.handle);
    const { data: artist, error } = await supabaseAdmin
      .from('artist_profiles')
      .select('*')
      .eq('handle', handle)
      .eq('is_public', true)
      .maybeSingle();
    if (error) throw error;
    if (!artist) return res.status(404).json({ success: false, error: 'Artist not found.' });

    const { data: packages } = await supabaseAdmin
      .from('artist_packages')
      .select('*')
      .eq('artist_id', artist.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    const { data: blackouts } = await supabaseAdmin
      .from('artist_blackouts')
      .select('id, start_date, end_date, reason')
      .eq('artist_id', artist.id)
      .gte('end_date', new Date().toISOString().slice(0, 10))
      .order('start_date', { ascending: true });

    // Attach worker user basics
    const { data: wp } = await supabaseAdmin
      .from('worker_profiles')
      .select('id, user_id, users(full_name, avatar_url, city, is_verified)')
      .eq('id', artist.worker_profile_id)
      .maybeSingle();

    res.json({
      success: true,
      artist: {
        ...artist,
        worker: wp?.users || null,
        worker_profile_id: artist.worker_profile_id,
      },
      packages: packages || [],
      blackouts: blackouts || [],
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── PUBLIC: GET /api/artists/by-worker/:workerProfileId ──────
router.get('/by-worker/:workerProfileId', async (req, res) => {
  try {
    const { data: artist, error } = await supabaseAdmin
      .from('artist_profiles')
      .select('id, handle, display_name, is_public')
      .eq('worker_profile_id', req.params.workerProfileId)
      .eq('is_public', true)
      .maybeSingle();
    if (error) throw error;
    if (!artist) return res.json({ success: true, artist: null });
    res.json({ success: true, artist });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── ME: GET /api/artists/me ──────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const artist = await getMyArtist(user.id);
    if (!artist) return res.json({ success: true, artist: null, packages: [], blackouts: [] });

    const { data: packages } = await supabaseAdmin
      .from('artist_packages')
      .select('*')
      .eq('artist_id', artist.id)
      .order('sort_order', { ascending: true });

    const { data: blackouts } = await supabaseAdmin
      .from('artist_blackouts')
      .select('*')
      .eq('artist_id', artist.id)
      .order('start_date', { ascending: true });

    res.json({ success: true, artist, packages: packages || [], blackouts: blackouts || [] });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

// ─── ME: PUT /api/artists/me ──────────────────────────────────
router.put('/me', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const workerProfileId = await getWorkerProfileId(user.id);
    if (!workerProfileId) {
      return res.status(400).json({ success: false, error: 'Worker profile required. Complete worker signup first.' });
    }

    const {
      handle, stage_name, genres, bio, epk_url, rider_json,
      band_size, city, is_public,
    } = req.body;

    const normalized = normalizeHandle(handle);
    if (!normalized || normalized.length < 3) {
      return res.status(400).json({ success: false, error: 'Handle must be at least 3 characters (a-z, 0-9, _ -).' });
    }
    if (!stage_name || !String(stage_name).trim()) {
      return res.status(400).json({ success: false, error: 'Stage name is required.' });
    }

    const payload = {
      worker_profile_id: workerProfileId,
      handle: normalized,
      stage_name: String(stage_name).trim(),
      genres: Array.isArray(genres) ? genres : (genres ? String(genres).split(',').map(g => g.trim()).filter(Boolean) : []),
      bio: bio || null,
      epk_url: epk_url || null,
      rider_json: rider_json || {},
      band_size: band_size ? parseInt(band_size, 10) : 1,
      city: city || null,
      is_public: is_public !== false,
      updated_at: new Date().toISOString(),
    };

    const existing = await getMyArtist(user.id);
    let artist;
    if (existing) {
      const { data, error } = await supabaseAdmin
        .from('artist_profiles')
        .update(payload)
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) throw error;
      artist = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('artist_profiles')
        .insert(payload)
        .select('*')
        .single();
      if (error) {
        if (/duplicate|unique/i.test(error.message)) {
          return res.status(409).json({ success: false, error: 'That handle is already taken.' });
        }
        throw error;
      }
      artist = data;
    }

    res.json({ success: true, artist });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── PACKAGES ─────────────────────────────────────────────────
router.post('/me/packages', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const artist = await getMyArtist(user.id);
    if (!artist) return res.status(400).json({ success: false, error: 'Create your artist profile first.' });

    const {
      title, description, duration_min, price, currency,
      deposit_pct, overtime_rate, travel_fee_rules, sort_order,
    } = req.body;

    if (!title || price == null) {
      return res.status(400).json({ success: false, error: 'title and price are required.' });
    }

    const { data, error } = await supabaseAdmin
      .from('artist_packages')
      .insert({
        artist_id: artist.id,
        title: String(title).trim(),
        description: description || null,
        duration_min: duration_min ? parseInt(duration_min, 10) : 60,
        price: Number(price),
        currency: currency || 'GHS',
        deposit_pct: deposit_pct != null ? Number(deposit_pct) : 30,
        overtime_rate: overtime_rate != null ? Number(overtime_rate) : null,
        travel_fee_rules: travel_fee_rules || {},
        sort_order: sort_order != null ? parseInt(sort_order, 10) : 0,
        is_active: true,
      })
      .select('*')
      .single();
    if (error) throw error;
    res.status(201).json({ success: true, package: data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.patch('/me/packages/:id', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const artist = await getMyArtist(user.id);
    if (!artist) return res.status(400).json({ success: false, error: 'Artist profile required.' });

    const allowed = [
      'title', 'description', 'duration_min', 'price', 'currency',
      'deposit_pct', 'overtime_rate', 'travel_fee_rules', 'is_active', 'sort_order',
    ];
    const updates = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const { data, error } = await supabaseAdmin
      .from('artist_packages')
      .update(updates)
      .eq('id', req.params.id)
      .eq('artist_id', artist.id)
      .select('*')
      .single();
    if (error) throw error;
    res.json({ success: true, package: data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete('/me/packages/:id', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const artist = await getMyArtist(user.id);
    if (!artist) return res.status(400).json({ success: false, error: 'Artist profile required.' });

    const { error } = await supabaseAdmin
      .from('artist_packages')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('artist_id', artist.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── BLACKOUTS ────────────────────────────────────────────────
router.post('/me/blackouts', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const artist = await getMyArtist(user.id);
    if (!artist) return res.status(400).json({ success: false, error: 'Artist profile required.' });

    const { start_date, end_date, reason } = req.body;
    if (!start_date || !end_date) {
      return res.status(400).json({ success: false, error: 'start_date and end_date are required.' });
    }

    const { data, error } = await supabaseAdmin
      .from('artist_blackouts')
      .insert({
        artist_id: artist.id,
        start_date,
        end_date,
        reason: reason || null,
      })
      .select('*')
      .single();
    if (error) throw error;
    res.status(201).json({ success: true, blackout: data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete('/me/blackouts/:id', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const artist = await getMyArtist(user.id);
    if (!artist) return res.status(400).json({ success: false, error: 'Artist profile required.' });

    const { error } = await supabaseAdmin
      .from('artist_blackouts')
      .delete()
      .eq('id', req.params.id)
      .eq('artist_id', artist.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── BOOK: POST /api/artists/book ─────────────────────────────
router.post('/book', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const {
      artist_id, package_id, scheduled_date,
      venue_type, guest_count, load_in_time,
      address, landmark_description, rider_accepted,
      description,
    } = req.body;

    if (!artist_id || !package_id || !scheduled_date) {
      return res.status(400).json({ success: false, error: 'artist_id, package_id and scheduled_date are required.' });
    }
    if (!rider_accepted) {
      return res.status(400).json({ success: false, error: 'You must accept the artist tech rider / booking terms.' });
    }

    const { data: artist, error: aErr } = await supabaseAdmin
      .from('artist_profiles')
      .select('*, worker_profiles(id, user_id)')
      .eq('id', artist_id)
      .eq('is_public', true)
      .single();
    if (aErr || !artist) return res.status(404).json({ success: false, error: 'Artist not found.' });

    const { data: pkg, error: pErr } = await supabaseAdmin
      .from('artist_packages')
      .select('*')
      .eq('id', package_id)
      .eq('artist_id', artist_id)
      .eq('is_active', true)
      .single();
    if (pErr || !pkg) return res.status(404).json({ success: false, error: 'Package not found.' });

    // Blackout check
    const day = String(scheduled_date).slice(0, 10);
    const { data: blocked } = await supabaseAdmin
      .from('artist_blackouts')
      .select('id')
      .eq('artist_id', artist_id)
      .lte('start_date', day)
      .gte('end_date', day)
      .limit(1);
    if (blocked?.length) {
      return res.status(409).json({ success: false, error: 'Artist is unavailable on that date.' });
    }

    const deposit = Math.round((Number(pkg.price) * Number(pkg.deposit_pct) / 100) * 100) / 100;
    const balance = Math.round((Number(pkg.price) - deposit) * 100) / 100;

    const { data: booking, error: bErr } = await supabaseAdmin
      .from('bookings')
      .insert({
        customer_id: user.id,
        worker_id: artist.worker_profiles?.id || artist.worker_profile_id,
        description: description || `${pkg.title} with ${artist.stage_name}`,
        agreed_price: pkg.price,
        currency: pkg.currency || 'GHS',
        status: 'pending',
        scheduled_date,
        address: address || null,
        landmark_description: landmark_description || null,
      })
      .select('*')
      .single();
    if (bErr) throw bErr;

    const { error: dErr } = await supabaseAdmin.from('booking_artist_details').insert({
      booking_id: booking.id,
      artist_id,
      package_id,
      venue_type: venue_type || null,
      guest_count: guest_count != null ? parseInt(guest_count, 10) : null,
      load_in_time: load_in_time || null,
      rider_accepted: true,
      deposit_amount: deposit,
      balance_amount: balance,
    });
    if (dErr) throw dErr;

    res.status(201).json({
      success: true,
      booking,
      deposit_amount: deposit,
      balance_amount: balance,
      currency: pkg.currency || 'GHS',
      message: 'Gig request created. Pay the deposit to confirm.',
    });
  } catch (err) {
    console.error('Artist book error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
