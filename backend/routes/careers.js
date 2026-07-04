// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/careers.js — public careers API.
// No auth required on GET — positions are public.
// POST applications are also public — applicants don't have
// WiamApp accounts.

import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const router = Router();

// GET all open positions — grouped by department for the careers page
router.get('/', async (req, res) => {
  try {
    const { department } = req.query;

    let query = supabaseAdmin
      .from('career_positions')
      .select('*')
      .eq('is_active', true)
      .order('department', { ascending: true })
      .order('title', { ascending: true });

    if (department) query = query.eq('department', department);

    const { data, error } = await query;
    if (error) throw error;

    // Group by department for easier rendering on the frontend
    const grouped = (data || []).reduce((acc, pos) => {
      (acc[pos.department] = acc[pos.department] || []).push(pos);
      return acc;
    }, {});

    res.json({ success: true, data: data || [], grouped });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET single position
router.get('/:positionKey', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('career_positions')
      .select('*')
      .eq('position_key', req.params.positionKey)
      .eq('is_active', true)
      .single();

    if (error || !data) return res.status(404).json({ success: false, error: 'Position not found.' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST submit application — validates required fields, prevents
// duplicate applications for the same position + email combination
router.post('/apply', async (req, res) => {
  try {
    const {
      positionId, positionTitle, fullName, email, phone,
      country, city, yearsExperience, relevantSkills,
      previousRoles, whyWiamapp, whatTheyBring,
      availability, linkedinUrl, portfolioUrl, cvUploadUrl,
    } = req.body;

    if (!positionId || !positionTitle || !fullName || !email || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Position, full name, email, and phone are all required.',
      });
    }

    // Prevent duplicates — one application per position per email.
    // Checked server-side since the table has no UNIQUE constraint
    // across both columns (intentional — someone may apply to
    // multiple positions).
    const { count } = await supabaseAdmin
      .from('career_applications')
      .select('id', { count: 'exact', head: true })
      .eq('position_id', positionId)
      .eq('email', email.toLowerCase());

    if (count > 0) {
      return res.status(409).json({
        success: false,
        error: 'You have already applied for this position. Our team will be in touch.',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('career_applications')
      .insert({
        position_id:      positionId,
        position_title:   positionTitle,
        full_name:        fullName,
        email:            email.toLowerCase(),
        phone,
        country:          country || 'Ghana',
        city:             city || null,
        years_experience: yearsExperience ? parseInt(yearsExperience, 10) : null,
        relevant_skills:  relevantSkills || null,
        previous_roles:   previousRoles || null,
        why_wiamapp:      whyWiamapp || null,
        what_they_bring:  whatTheyBring || null,
        availability:     availability || null,
        linkedin_url:     linkedinUrl || null,
        portfolio_url:    portfolioUrl || null,
        cv_upload_url:    cvUploadUrl || null,
        status:           'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Notify the hiring team (admins flagged as HR in the system)
    const { data: admins } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('role', 'admin');

    if (admins?.length) {
      await supabaseAdmin.from('notifications').insert(
        admins.map(a => ({
          user_id: a.id,
          title: `New application: ${positionTitle}`,
          body: `${fullName} (${email}) has applied for ${positionTitle}. CV${cvUploadUrl ? ' attached' : ' not provided'}.`,
          type: 'system',
          data: { application_id: data.id },
        }))
      );
    }

    res.status(201).json({
      success: true,
      data,
      message: `Application received. We review every application personally and will be in touch at ${email} if there's a fit.`,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
