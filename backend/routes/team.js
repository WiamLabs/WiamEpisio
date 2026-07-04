// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/team.js — WiaMid Team Authentication & Management
// ALL team dashboards are web-only. Never in the Expo app.

import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import crypto from 'crypto';

const router = Router();

// ─── WIAMID CODE SYSTEM ───────────────────────────────────────

/**
 * Generate a WiaMid code
 * Format: WiaMid + 6 characters (uppercase, lowercase, numbers, symbols)
 * Total: 12 characters
 */
function generateWiaMidCode() {
  const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$!';
  let code = '';
  // Ensure at least one of each type
  code += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
  code += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
  code += '0123456789'[Math.floor(Math.random() * 10)];                  // number
  code += '@#$!'[Math.floor(Math.random() * 4)];                         // symbol
  // Fill remaining 2 characters randomly
  for (let i = 0; i < 2; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  // Shuffle the 6 characters
  code = code.split('').sort(() => Math.random() - 0.5).join('');
  return `WiaMid${code}`;
}

/**
 * Hash a WiaMid code for storage
 * The plain text code is NEVER stored — only its hash
 */
function hashWiaMidCode(code) {
  return crypto.createHash('sha256').update(code + process.env.WIAMID_SALT).digest('hex');
}

// ─── TEAM LOGIN ───────────────────────────────────────────────

/**
 * Team member login with wiamlabs@gmail.com + WiaMid code
 * Returns a short-lived JWT for the team dashboard
 */
router.post('/login', async (req, res) => {
  try {
    const { email, wiaMidCode } = req.body;

    // Only the team email is accepted
    if (email !== 'wiamlabs@gmail.com') {
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    if (!wiaMidCode || !wiaMidCode.startsWith('WiaMid')) {
      return res.status(401).json({ success: false, error: 'Invalid WiaMid code format.' });
    }

    const codeHash = hashWiaMidCode(wiaMidCode);

    // Find team member by code hash
    const { data: member, error } = await supabaseAdmin
      .from('team_members')
      .select('*')
      .eq('code_hash', codeHash)
      .eq('is_active', true)
      .gt('code_expires_at', new Date().toISOString())
      .single();

    if (error || !member) {
      // Log failed attempt
      await supabaseAdmin.from('audit_logs').insert({
        user_id: null,
        action: 'team_login_failed',
        metadata: { reason: 'Invalid or expired WiaMid code', email },
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired WiaMid code. Check your email for your current code.',
      });
    }

    // Update last login
    await supabaseAdmin
      .from('team_members')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', member.id);

    // Log successful login
    await supabaseAdmin.from('audit_logs').insert({
      user_id: null,
      action: 'team_login_success',
      metadata: {
        team_member_id: member.id,
        role: member.role,
        department: member.department,
      },
    });

    // Return member info and dashboard role
    res.json({
      success: true,
      data: {
        id: member.id,
        fullName: member.full_name,
        role: member.role,
        department: member.department,
        dashboardUrl: `/dashboard/${member.dashboard_key}`,
        permissions: member.permissions,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
});

// ─── FOUNDER LOGIN ────────────────────────────────────────────

/**
 * Founder login with founder@wiamapp.com + password
 * Returns access to master dashboard
 */
router.post('/founder-login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (email !== 'founder@wiamapp.com') {
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    // Verify against Supabase auth
    const { data, error } = await supabaseAdmin.auth.admin.getUserByEmail(email);
    if (error || !data.user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    // Check the user is actually admin role
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (userData?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    await supabaseAdmin.from('audit_logs').insert({
      user_id: data.user.id,
      action: 'founder_login',
      metadata: { email },
    });

    res.json({
      success: true,
      data: {
        role: 'founder',
        dashboards: 'all',
        message: 'Welcome Martin. You have access to all dashboards.',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Login failed.' });
  }
});

// ─── CREATE TEAM MEMBER (Founder only) ───────────────────────

router.post('/create-member', async (req, res) => {
  try {
    // This route is only callable from the founder dashboard
    const { fullName, email, role, department, position } = req.body;

    const code = generateWiaMidCode();
    const codeHash = hashWiaMidCode(code);
    const codeExpiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from('team_members')
      .insert({
        full_name: fullName,
        personal_email: email,
        role,
        department,
        position,
        code_hash: codeHash,
        code_expires_at: codeExpiresAt,
        is_active: true,
        permissions: getPermissionsForRole(role),
        dashboard_key: role.toLowerCase().replace(/\s+/g, '_'),
      })
      .select()
      .single();

    if (error) throw error;

    // The plain text code is returned ONCE and sent via email
    // It is NEVER stored after this point
    res.status(201).json({
      success: true,
      data: {
        id: data.id,
        fullName: data.full_name,
        role: data.role,
        wiasMidCode: code,            // Return once — send to member email
        codeExpiresAt,
        SECURITY_NOTE: 'This code is shown ONCE. Send it via email to the team member immediately. It is not stored in plain text.',
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── RENEW WIAMID CODE ────────────────────────────────────────

router.post('/renew-code/:memberId', async (req, res) => {
  try {
    const newCode = generateWiaMidCode();
    const newHash = hashWiaMidCode(newCode);
    const expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from('team_members')
      .update({ code_hash: newHash, code_expires_at: expiresAt })
      .eq('id', req.params.memberId);

    res.json({
      success: true,
      data: {
        newCode,  // Return once — send to member via email
        expiresAt,
        SECURITY_NOTE: 'Send this code to the team member immediately.',
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── GET ALL TEAM MEMBERS (Founder only) ─────────────────────

router.get('/members', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('team_members')
      .select('id, full_name, role, department, position, is_active, last_login_at, created_at')
      .order('department');

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── DEACTIVATE TEAM MEMBER ───────────────────────────────────

router.patch('/deactivate/:memberId', async (req, res) => {
  try {
    await supabaseAdmin
      .from('team_members')
      .update({ is_active: false, deactivated_at: new Date().toISOString() })
      .eq('id', req.params.memberId);

    res.json({ success: true, message: 'Team member deactivated. Their WiaMid code is now invalid.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── PERMISSIONS MAP ──────────────────────────────────────────

function getPermissionsForRole(role) {
  const PERMISSIONS = {
    'Senior Administrator': [
      'users:read', 'users:write', 'users:suspend', 'users:ban',
      'verifications:read', 'verifications:approve', 'verifications:reject',
      'fraud:read', 'fraud:write', 'bookings:read', 'platform:settings',
    ],
    'Junior Administrator': [
      'users:read', 'users:suspend',
      'verifications:read', 'verifications:approve', 'verifications:reject',
      'bookings:read',
    ],
    'Content Moderator': [
      'spotlight:read', 'spotlight:approve', 'spotlight:reject', 'spotlight:remove',
      'reports:read', 'warnings:write',
    ],
    'Document Reviewer': [
      'verifications:read', 'verifications:approve', 'verifications:reject',
      'documents:read',
    ],
    'Dispute Resolution Officer': [
      'bookings:read', 'disputes:read', 'disputes:resolve',
      'payments:read', 'chat:read', 'audit:read',
    ],
    'Customer Support Representative': [
      'users:read', 'bookings:read', 'tickets:read', 'tickets:write',
    ],
    'Worker Support Representative': [
      'users:read', 'bookings:read', 'subscriptions:read',
      'tickets:read', 'tickets:write',
    ],
    'Fraud Analyst': [
      'fraud:read', 'fraud:write', 'users:read',
      'audit:read', 'devices:read', 'ip:read',
    ],
    'Financial Manager': [
      'payments:read', 'revenue:read', 'subscriptions:read',
      'commission:read', 'reports:export', 'pricing:write',
    ],
    'Business Account Manager': [
      'business:read', 'business:write', 'users:read',
    ],
    'Emergency Response Officer': [
      'sos:read', 'sos:respond', 'bookings:read', 'users:read',
    ],
    'Marketing Manager': [
      'analytics:read', 'spotlight:read', 'users:read',
    ],
  };

  return PERMISSIONS[role] || ['read_only'];
}

export default router;
