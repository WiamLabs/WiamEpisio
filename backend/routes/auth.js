// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/auth.js
// V2/V3 Plan compliant — handles all roles and fields

import { Router } from 'express';
import { supabaseAdmin, verifyUserToken } from '../lib/supabaseAdmin.js';
import { sendEmail } from '../lib/resend.js';

const router = Router();

// ─── POST /api/auth/register ──────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const {
      fullName, email: rawEmail, phone, password, role,
      city, country, countryCode,
      landmarkDescription, digitalAddressCode, latitude, longitude,
      category,    // workers only
      companyName, // business only
    } = req.body;

    const email = String(rawEmail || '').trim().toLowerCase();

    // Validate required fields
    if (!fullName || !email || !phone || !password || !role || !city || !country) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    if (!['customer', 'worker', 'business'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }
    if (role === 'worker' && !category) {
      return res.status(400).json({ error: 'Category is required for workers.' });
    }
    if (role === 'business' && !companyName) {
      return res.status(400).json({ error: 'Company name is required for businesses.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    // Create Supabase auth user.
    // email_confirm: false — the user MUST verify via the OTP we email them
    // (see /send-otp + /verify-otp). Login stays gated until then.
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { full_name: fullName, role },
    });
    if (error) {
      // Friendly message when the email is already taken
      if (/already|exist|registered/i.test(error.message)) {
        return res.status(409).json({
          success: false,
          error: 'An account with this email already exists. Please log in instead.',
        });
      }
      throw error;
    }

    const userId = data.user.id;

    // From here on, if ANY step fails we must remove the auth user we just
    // created — otherwise the email gets "stuck" and the user can never retry.
    try {
      // Upsert users row — `on_auth_user_created` may already have inserted a
      // stub (id/email/role) when auth.admin.createUser ran.
      const { error: userError } = await supabaseAdmin.from('users').upsert({
        id:           userId,
        full_name:    fullName,
        email,
        phone,
        role,
        city,
        country,
        country_code: countryCode || null,
        landmark_description: landmarkDescription || null,
        digital_address_code: digitalAddressCode || null,
        latitude:     latitude ?? null,
        longitude:    longitude ?? null,
        is_verified:  false,
        is_active:    true,
      }, { onConflict: 'id' });
      if (userError) throw userError;

      // If worker — create worker_profile + set category
      if (role === 'worker') {
        const { data: wpData, error: wpError } = await supabaseAdmin
          .from('worker_profiles')
          .insert({
            user_id: userId,
            location_name: city || null,
            landmark_description: landmarkDescription || null,
            digital_address_code: digitalAddressCode || null,
            latitude:  latitude ?? null,
            longitude: longitude ?? null,
          })
          .select('id')
          .single();
        if (wpError) throw wpError;

        // Match category flexibly — live DB may use short names
        // ("Automotive & Mechanical") while the app sends full names
        // ("Automotive & Mechanical Repair").
        const catName = String(category || '').trim();
        let catData = null;
        if (catName) {
          const { data: exact } = await supabaseAdmin
            .from('categories')
            .select('id, name')
            .ilike('name', catName)
            .maybeSingle();
          catData = exact;
          if (!catData) {
            const { data: contains } = await supabaseAdmin
              .from('categories')
              .select('id, name')
              .ilike('name', `%${catName}%`)
              .limit(1)
              .maybeSingle();
            catData = contains;
          }
          if (!catData) {
            // App name longer than DB: take first meaningful tokens
            const stem = catName.split(/[&,]/)[0].trim();
            if (stem.length >= 4) {
              const { data: prefix } = await supabaseAdmin
                .from('categories')
                .select('id, name')
                .ilike('name', `${stem}%`)
                .limit(1)
                .maybeSingle();
              catData = prefix;
            }
          }
        }

        if (catData) {
          await supabaseAdmin.from('worker_categories').insert({
            worker_id:   wpData.id,
            category_id: catData.id,
          });
        }
      }

      // If business — create business_profile
      if (role === 'business') {
        const { error: bpError } = await supabaseAdmin.from('business_profiles').insert({
          user_id:      userId,
          company_name: companyName,
          plan:         'starter',
        });
        if (bpError) throw bpError;
      }

      // Log to audit_logs (best-effort — never block registration on this)
      await supabaseAdmin.from('audit_logs').insert({
        user_id:  userId,
        action:   'register',
        metadata: { role, city, country },
      });

      // Email verification OTP once from the server (avoid client double-send
      // which invalidates the first code before the user opens the email).
      let otpSent = false;
      let otpError = null;
      try {
        await mintAndEmailOtp(email);
        otpSent = true;
      } catch (otpErr) {
        otpError = otpErr.message || 'Could not send verification email.';
        console.error('Register OTP send failed:', otpError);
      }

      res.status(201).json({
        success: true,
        message: otpSent
          ? 'Account created successfully. Check your email for the verification code.'
          : 'Account created. We could not send the verification email — use Resend on the next screen.',
        userId,
        otpSent,
        otpError,
      });
    } catch (innerErr) {
      // Roll back the orphaned auth user so the email can be reused.
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      throw innerErr;
    }

  } catch (err) {
    console.error('Register error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (error) {
      // Email not yet verified — tell the app to route to the OTP screen
      if (/email not confirmed|not confirmed/i.test(error.message)) {
        return res.status(403).json({
          success: false,
          needsVerification: true,
          email,
          error: 'Please verify your email to continue.',
        });
      }
      throw error;
    }

    // Even if the project allows unconfirmed sign-in, enforce verification here
    if (!data.user.email_confirmed_at) {
      return res.status(403).json({
        success: false,
        needsVerification: true,
        email,
        error: 'Please verify your email to continue.',
      });
    }

    // Get user profile
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    await supabaseAdmin.from('audit_logs').insert({
      user_id:  data.user.id,
      action:   'login',
      metadata: {},
    });

    res.json({
      success: true,
      token:   data.session.access_token,
      user:    profile,
    });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

// Shared OTP mint + Brevo email (used by /send-otp and post-register).
async function mintAndEmailOtp(rawEmail) {
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email) throw new Error('Email is required.');

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Invalidate previous unused codes (match any casing left in DB)
  await supabaseAdmin.from('otp_codes').update({ used: true }).ilike('email', email).eq('used', false);

  const { error: insertErr } = await supabaseAdmin.from('otp_codes').insert({
    email,
    code: otp,
    expires_at: expiresAt.toISOString(),
  });
  if (insertErr) throw insertErr;

  await sendEmail({
    to: email,
    subject: 'Your WiamApp verification code',
    required: true,
    html: `
      <div style="font-family:Arial,sans-serif;color:#1f2937;">
        <h2 style="color:#0D0D2B;">Verify your email</h2>
        <p>Your WiamApp verification code is:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#0D0D2B;">${otp}</p>
        <p style="color:#6b7280;">This code expires in 10 minutes. If you didn't request it, ignore this email.</p>
      </div>`,
  });

  console.log(`OTP emailed to ${email}`);
  return { email, otp };
}

// ─── POST /api/auth/send-otp ──────────────────────────────────
router.post('/send-otp', async (req, res) => {
  try {
    await mintAndEmailOtp(req.body?.email);
    res.json({ success: true, message: 'OTP sent.' });
  } catch (err) {
    console.error('send-otp error:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Could not send verification code.' });
  }
});

// ─── POST /api/auth/verify-otp ───────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const code  = String(req.body?.code || '').trim();
    if (!email || !code) {
      return res.status(400).json({ success: false, error: 'Email and code are required.' });
    }

    const { data, error } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (error || !data) {
      return res.status(400).json({ success: false, error: 'Invalid or expired OTP.' });
    }
    await supabaseAdmin.from('otp_codes').update({ used: true }).eq('id', data.id);

    // Mark the user's email as confirmed in Supabase Auth so login is allowed
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('id')
      .ilike('email', email)
      .maybeSingle();
    if (profile?.id) {
      await supabaseAdmin.auth.admin.updateUserById(profile.id, { email_confirm: true });
    }

    res.json({ success: true, message: 'OTP verified.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────
router.post('/logout', async (req, res) => {
  res.json({ success: true, message: 'Logged out.' });
});

// ─── POST /api/auth/forgot-password ──────────────────────────
// Sends a WiamApp-branded email via Brevo (not Supabase Auth mailer).
// Includes a web recovery link + a 6-digit code for in-app reset.
// Shared implementation also used by WiamSafety recovery webhook.
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const { sendPasswordResetForEmail } = await import('../lib/passwordReset.js');
    await sendPasswordResetForEmail(email);

    // Always respond success to avoid email enumeration
    res.json({ success: true, message: 'If that email is registered, a reset link is on its way.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── POST /api/auth/reset-password ───────────────────────────
// In-app reset: email + OTP from Brevo email + new password.
router.post('/reset-password', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const code = String(req.body.code || req.body.token || '').trim();
    const password = String(req.body.password || '');

    if (!email || !code || !password) {
      return res.status(400).json({ success: false, error: 'Email, code, and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
    }

    const { data: otpRow, error: otpError } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (otpError || !otpRow) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset code.' });
    }

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (!profile?.id) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset code.' });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
      password,
    });
    if (updateError) throw updateError;

    await supabaseAdmin.from('otp_codes').update({ used: true }).eq('id', otpRow.id);

    // If this reset was started via WiamSafety handoff, tell Core it completed.
    try {
      const { data: handoff } = await supabaseAdmin
        .from('wiamsafety_handoffs')
        .select('reference_id')
        .eq('product_user_id', profile.id)
        .eq('action', 'password_reset')
        .order('consumed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (handoff?.reference_id) {
        const { notifyWiamSafetyResetComplete } = await import('../lib/wiamsafety.js');
        notifyWiamSafetyResetComplete(handoff.reference_id).catch(() => {});
      }
    } catch (_) { /* optional — never block password update */ }

    res.json({ success: true, message: 'Password updated. You can log in now.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});
// ─── DELETE /api/auth/account ─────────────────────────────────
router.post('/data-export-request', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { data, error } = await supabaseAdmin
      .from('data_export_requests')
      .insert({ user_id: user.id })
      .select()
      .single();

    if (error) throw error;

    const { data: admins } = await supabaseAdmin
      .from('users').select('id').eq('role', 'admin');

    if (admins?.length) {
      await supabaseAdmin.from('notifications').insert(
        admins.map(a => ({
          user_id: a.id,
          title: 'Data export request',
          body: `A user has requested a full export of their data. Fulfil within 48 hours.`,
          type: 'system',
          data: { export_request_id: data.id, requesting_user_id: user.id },
        }))
      );
    }

    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete('/account', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    await supabaseAdmin.auth.admin.deleteUser(user.id);
    res.json({ success: true, message: 'Account deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
