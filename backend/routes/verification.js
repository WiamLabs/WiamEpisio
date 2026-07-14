// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/verification.js
// V2/V3 Plan compliant
// Handles: document upload to R2 Private + submit to admin queue
// All ID documents go to R2 PRIVATE bucket — never public

import { Router } from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { supabaseAdmin, verifyUserToken } from '../lib/supabaseAdmin.js';
import { qualifyReferral } from './referrals.js';
import { sendVerificationSubmittedEmail } from '../lib/resend.js';
import crypto from 'crypto';

const router = Router();

// ── R2 Private bucket client ──────────────────────────────────
const r2Private = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_PRIVATE_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.R2_PRIVATE_ACCESS_KEY,
    secretAccessKey: process.env.R2_PRIVATE_SECRET_KEY,
  },
});

// Multer — memory storage (upload directly to R2)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, and WebP images are allowed.'));
  },
});

// ── POST /api/verification/upload-document ────────────────────
// Uploads ID front, ID back, or selfie to R2 Private
// Returns: { key } — the R2 storage key for this document
router.post('/upload-document', upload.single('document'), async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const { docType, idType } = req.body;
    if (!['id_front', 'id_back', 'selfie'].includes(docType)) {
      return res.status(400).json({ error: 'Invalid document type.' });
    }

    // Generate secure unique key
    const hash = crypto.randomBytes(16).toString('hex');
    const ext  = req.file.mimetype === 'image/png' ? 'png' : 'jpg';
    const key  = `verifications/${user.id}/${docType}_${hash}.${ext}`;

    // Upload to R2 Private bucket
    await r2Private.send(new PutObjectCommand({
      Bucket:      process.env.R2_PRIVATE_BUCKET_NAME,
      Key:         key,
      Body:        req.file.buffer,
      ContentType: req.file.mimetype,
      Metadata: {
        userId:  user.id,
        docType,
        idType:  idType || 'unknown',
      },
    }));

    // Save key reference — workers only. Customers upload keys then call
    // submit-customer-simple which writes customer_document_reviews.
    const { data: roleRow } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleRow?.role === 'worker') {
      const column = docType === 'id_front' ? 'id_front_key'
                   : docType === 'id_back'  ? 'id_back_key'
                   : 'selfie_key';

      await supabaseAdmin
        .from('worker_verifications')
        .upsert({
          user_id:   user.id,
          [column]:  key,
          id_type:   idType || null,
          status:    'uploading',
        }, { onConflict: 'user_id' });
    }

    res.json({ success: true, key });

  } catch (err) {
    console.error('Upload error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/verification/submit-worker ─────────────────────
// Called after all documents uploaded — moves to admin review queue
router.post('/submit-worker', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { idType, frontKey, backKey, selfieKey } = req.body;

    if (!idType || !frontKey || !selfieKey) {
      return res.status(400).json({ error: 'ID type, front photo, and selfie are required.' });
    }

    // Update worker_verifications to pending
    const { error: verifyError } = await supabaseAdmin
      .from('worker_verifications')
      .upsert({
        user_id:     user.id,
        id_type:     idType,
        id_front_key: frontKey,
        id_back_key:  backKey || null,
        selfie_key:   selfieKey,
        status:       'pending',
        submitted_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (verifyError) throw verifyError;

    // Update user record — mark verification submitted
    await supabaseAdmin
      .from('users')
      .update({ verification_submitted: true })
      .eq('id', user.id);

    // Log to audit
    await supabaseAdmin.from('audit_logs').insert({
      user_id:  user.id,
      action:   'verification_submitted',
      metadata: { idType },
    });

    // Sets clear expectations, especially important for workers who
    // registered on the web before the app was even distributed —
    // otherwise they have zero visibility into what happens next.
    const { data: userRow } = await supabaseAdmin
      .from('users').select('email, full_name').eq('id', user.id).single();
    if (userRow?.email) {
      await sendVerificationSubmittedEmail(userRow.email, userRow.full_name);
    }

    // TODO: send push notification to admin team

    res.json({
      success: true,
      message: 'Verification submitted. Admin will review within 24 hours.',
    });

  } catch (err) {
    console.error('Submit error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/verification/status ─────────────────────────────
// Worker checks their current verification status
router.get('/status', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { data, error } = await supabaseAdmin
      .from('worker_verifications')
      .select('status, submitted_at, reviewed_at, rejection_reason')
      .eq('user_id', user.id)
      .single();

    if (error) {
      return res.json({ success: true, status: 'not_submitted' });
    }

    res.json({ success: true, ...data });

  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

// ── POST /api/verification/submit-customer ────────────────────
// Customer submits ID for first-booking verification
router.post('/submit-customer', upload.fields([
  { name: 'id_front', maxCount: 1 },
  { name: 'selfie',   maxCount: 1 },
]), async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { idType } = req.body;

    if (!req.files?.id_front || !req.files?.selfie) {
      return res.status(400).json({ error: 'ID photo and selfie are required.' });
    }

    // Upload ID front
    const frontHash = crypto.randomBytes(16).toString('hex');
    const frontKey  = `customer-verifications/${user.id}/id_front_${frontHash}.jpg`;
    await r2Private.send(new PutObjectCommand({
      Bucket:      process.env.R2_PRIVATE_BUCKET_NAME,
      Key:         frontKey,
      Body:        req.files.id_front[0].buffer,
      ContentType: req.files.id_front[0].mimetype,
    }));

    // Upload selfie
    const selfieHash = crypto.randomBytes(16).toString('hex');
    const selfieKey  = `customer-verifications/${user.id}/selfie_${selfieHash}.jpg`;
    await r2Private.send(new PutObjectCommand({
      Bucket:      process.env.R2_PRIVATE_BUCKET_NAME,
      Key:         selfieKey,
      Body:        req.files.selfie[0].buffer,
      ContentType: req.files.selfie[0].mimetype,
    }));

    // Close older pending reviews, then insert current submission for Founder queue
    await supabaseAdmin.from('users').update({
      customer_id_type:             idType || null,
      customer_id_front_key:        frontKey,
      customer_selfie_key:          selfieKey,
      customer_verification_status: 'pending',
    }).eq('id', user.id);

    await supabaseAdmin
      .from('customer_document_reviews')
      .update({ status: 'more_info' })
      .eq('user_id', user.id)
      .eq('status', 'pending');

    const { error: reviewErr } = await supabaseAdmin
      .from('customer_document_reviews')
      .insert({
        user_id:      user.id,
        id_type:      idType || 'unknown',
        id_front_key: frontKey,
        selfie_key:   selfieKey,
        status:       'pending',
        submitted_at: new Date().toISOString(),
      });

    if (reviewErr) throw reviewErr;

    await supabaseAdmin.from('audit_logs').insert({
      user_id:  user.id,
      action:   'customer_verification_submitted',
      metadata: { idType },
    });

    res.json({
      success: true,
      message: 'Customer verification submitted. Admin will review within 24 hours.',
    });

  } catch (err) {
    console.error('Customer verify error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/verification/submit-customer-simple ─────────────
// Mobile flow: upload-document for front + selfie, then JSON submit.
router.post('/submit-customer-simple', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { idType, frontKey, selfieKey, backKey } = req.body;

    if (!frontKey || !selfieKey) {
      return res.status(400).json({ error: 'ID front and selfie keys are required.' });
    }

    await supabaseAdmin.from('users').update({
      customer_id_type:             idType || null,
      customer_id_front_key:        frontKey,
      customer_selfie_key:          selfieKey,
      customer_verification_status: 'pending',
    }).eq('id', user.id);

    // Close any older pending rows for this user, then insert current submission
    await supabaseAdmin
      .from('customer_document_reviews')
      .update({ status: 'more_info' })
      .eq('user_id', user.id)
      .eq('status', 'pending');

    const { error: insertErr } = await supabaseAdmin
      .from('customer_document_reviews')
      .insert({
        user_id:      user.id,
        id_type:      idType || 'unknown',
        id_front_key: frontKey,
        id_back_key:  backKey || null,
        selfie_key:   selfieKey,
        status:       'pending',
        submitted_at: new Date().toISOString(),
      });

    if (insertErr) throw insertErr;

    await supabaseAdmin.from('audit_logs').insert({
      user_id:  user.id,
      action:   'customer_verification_submitted',
      metadata: { idType, via: 'submit-customer-simple' },
    });

    const { data: userRow } = await supabaseAdmin
      .from('users').select('email, full_name').eq('id', user.id).single();
    if (userRow?.email) {
      await sendVerificationSubmittedEmail(userRow.email, userRow.full_name);
    }

    res.json({
      success: true,
      message: 'Customer verification submitted. Admin will review within 24 hours.',
    });
  } catch (err) {
    console.error('Customer simple submit error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── ADMIN: POST /api/verification/approve/:userId ─────────────
// Admin approves a worker verification (team dashboard only)
router.post('/approve/:userId', async (req, res) => {
  try {
    const admin = await verifyUserToken(req.headers.authorization);

    // Only admin role can approve
    const { data: adminUser } = await supabaseAdmin
      .from('users').select('role').eq('id', admin.id).single();
    if (adminUser?.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized.' });
    }

    const { userId } = req.params;

    await supabaseAdmin.from('worker_verifications').update({
      status:      'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.id,
    }).eq('user_id', userId);

    await supabaseAdmin.from('users').update({
      is_verified: true,
    }).eq('id', userId);

    // CRITICAL: bookings.js checks worker_profiles.is_verified (not
    // users.is_verified) before allowing anyone to book this worker.
    // Without this update a newly-approved worker would still be
    // unbookable everywhere in the app.
    await supabaseAdmin.from('worker_profiles').update({
      is_verified: true,
      verified_badge: true,
    }).eq('user_id', userId);

    await supabaseAdmin.from('audit_logs').insert({
      user_id:  admin.id,
      action:   'verification_approved',
      metadata: { targetUserId: userId },
    });

    // Recalculate the profile-completion checklist now that the
    // worker is verified, and unlock any referral reward waiting
    // on this exact moment.
    const { data: wp } = await supabaseAdmin
      .from('worker_profiles').select('id').eq('user_id', userId).maybeSingle();
    if (wp) {
      await supabaseAdmin.rpc('recalculate_profile_completion', { p_worker_profile_id: wp.id });
    }
    await qualifyReferral({ referredUserId: userId, kind: 'worker_verified' });

    // TODO: send push + email to worker

    res.json({ success: true, message: 'Worker verification approved.' });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── ADMIN: POST /api/verification/reject/:userId ──────────────
router.post('/reject/:userId', async (req, res) => {
  try {
    const admin = await verifyUserToken(req.headers.authorization);

    const { data: adminUser } = await supabaseAdmin
      .from('users').select('role').eq('id', admin.id).single();
    if (adminUser?.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized.' });
    }

    const { userId } = req.params;
    const { reason }  = req.body;

    await supabaseAdmin.from('worker_verifications').update({
      status:           'rejected',
      reviewed_at:      new Date().toISOString(),
      reviewed_by:      admin.id,
      rejection_reason: reason || 'Documents unclear or incomplete.',
    }).eq('user_id', userId);

    await supabaseAdmin.from('audit_logs').insert({
      user_id:  admin.id,
      action:   'verification_rejected',
      metadata: { targetUserId: userId, reason },
    });

    // TODO: send push + email to worker with reason

    res.json({ success: true, message: 'Verification rejected.' });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
