// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/disputes.js — Dispute filing + admin resolution
//
// Either side of a booking can raise a dispute with evidence
// (photos, description). Filing one flips the booking to
// 'disputed' (see migration 035 trigger) which freezes payout
// until an admin resolves it. This is the missing piece the
// master-plan audit flagged: disputed was a status label with
// no actual workflow behind it.

import { Router } from 'express';
import multer from 'multer';
import { supabaseAdmin, verifyUserToken } from '../lib/supabaseAdmin.js';
import { uploadDisputeEvidence } from '../lib/r2Client.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const REASONS = ['work_not_done', 'quality', 'no_show', 'payment', 'other'];

// File a new dispute on a booking
router.post('/', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { bookingId, reason, description } = req.body;

    if (!bookingId || !reason || !description) {
      return res.status(400).json({ error: 'bookingId, reason and description are required.' });
    }
    if (!REASONS.includes(reason)) {
      return res.status(400).json({ error: `reason must be one of: ${REASONS.join(', ')}` });
    }

    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('id, customer_id, worker_id, worker_profiles(user_id)')
      .eq('id', bookingId).single();

    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    const isParty = booking.customer_id === user.id || booking.worker_profiles?.user_id === user.id;
    if (!isParty) return res.status(403).json({ error: 'You are not part of this booking.' });

    const { data: dispute, error } = await supabaseAdmin
      .from('disputes')
      .insert({ booking_id: bookingId, raised_by: user.id, reason, description, status: 'open' })
      .select().single();

    if (error) throw error;

    // Notify the other party + admins
    const otherPartyId = booking.customer_id === user.id ? booking.worker_profiles?.user_id : booking.customer_id;
    if (otherPartyId) {
      await supabaseAdmin.from('notifications').insert({
        user_id: otherPartyId,
        title: 'A dispute was filed on your booking',
        body: 'Payment is on hold until our team reviews this booking. You can add your own evidence.',
        type: 'booking',
        data: { booking_id: bookingId, dispute_id: dispute.id },
      });
    }

    res.status(201).json(dispute);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Upload evidence (photo/screenshot) for an existing dispute
router.post('/:id/evidence', upload.single('file'), async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    if (!req.file) return res.status(400).json({ error: 'No file provided.' });

    const { data: dispute } = await supabaseAdmin.from('disputes').select('*').eq('id', req.params.id).single();
    if (!dispute) return res.status(404).json({ error: 'Dispute not found.' });

    const url = await uploadDisputeEvidence(req.file.buffer, dispute.id);

    const { data: updated, error } = await supabaseAdmin
      .from('disputes')
      .update({ evidence_urls: [...(dispute.evidence_urls || []), url] })
      .eq('id', dispute.id)
      .select().single();

    if (error) throw error;
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get disputes for a specific booking (either party or admin)
router.get('/booking/:bookingId', async (req, res) => {
  try {
    await verifyUserToken(req.headers.authorization);
    const { data, error } = await supabaseAdmin
      .from('disputes').select('*').eq('booking_id', req.params.bookingId).order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// My disputes (raised by me or against my bookings)
router.get('/my-disputes', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { data, error } = await supabaseAdmin
      .from('disputes')
      .select('*, bookings(id, description, agreed_price, status)')
      .eq('raised_by', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── ADMIN RESOLUTION ────────────────────────────────────────

router.get('/admin/open', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { data: adminUser } = await supabaseAdmin.from('users').select('role').eq('id', user.id).single();
    if (adminUser?.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });

    const { data, error } = await supabaseAdmin
      .from('disputes')
      .select('*, bookings(id, description, agreed_price, currency, customer_id, worker_id)')
      .in('status', ['open', 'under_review'])
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/resolve', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { data: adminUser } = await supabaseAdmin.from('users').select('role').eq('id', user.id).single();
    if (adminUser?.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });

    const { status, resolutionNote } = req.body;
    const validStatuses = ['resolved_customer', 'resolved_worker', 'resolved_split', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const { data: dispute, error } = await supabaseAdmin
      .from('disputes')
      .update({ status, resolution_note: resolutionNote, resolved_by: user.id, resolved_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*, bookings(customer_id, worker_id, worker_profiles(user_id))')
      .single();

    if (error) throw error;

    // Notify both parties of the outcome
    const custId = dispute.bookings?.customer_id;
    const workerUserId = dispute.bookings?.worker_profiles?.user_id;
    for (const uid of [custId, workerUserId].filter(Boolean)) {
      await supabaseAdmin.from('notifications').insert({
        user_id: uid,
        title: 'Dispute resolved',
        body: resolutionNote || 'Our team has made a decision on your dispute.',
        type: 'booking',
        data: { dispute_id: dispute.id, status },
      });
    }

    // Recalculate the customer's trust score after a resolution
    if (custId) {
      await supabaseAdmin.rpc('recalculate_customer_trust_score', { p_customer_id: custId });
    }

    res.json(dispute);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
