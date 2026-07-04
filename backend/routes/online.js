// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/online.js — Online status tracking

import { Router } from 'express';
import { supabaseAdmin, verifyUserToken } from '../lib/supabaseAdmin.js';

const router = Router();

// Update user's online status (called every 60 seconds by the app)
router.post('/heartbeat', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    await supabaseAdmin
      .from('user_online_status')
      .upsert({
        user_id: user.id,
        is_online: true,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Set user as offline (called when app goes to background)
router.post('/offline', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    await supabaseAdmin
      .from('user_online_status')
      .upsert({
        user_id: user.id,
        is_online: false,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Get online status for multiple users
router.post('/status', async (req, res) => {
  try {
    await verifyUserToken(req.headers.authorization);
    const { userIds } = req.body;

    const { data, error } = await supabaseAdmin
      .from('user_online_status')
      .select('user_id, is_online, last_seen_at')
      .in('user_id', userIds);

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
