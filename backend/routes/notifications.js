// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/notifications.js

import { Router } from 'express';
import { supabaseAdmin, verifyUserToken } from '../lib/supabaseAdmin.js';

const router = Router();

// Get all notifications for current user
router.get('/', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get unread count
router.get('/unread-count', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { count, error } = await supabaseAdmin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) throw error;
    res.json({ count: count || 0 });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Mark one notification as read
router.patch('/:id/read', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', req.params.id)
      .eq('user_id', user.id);

    if (error) throw error;
    res.json({ message: 'Notification marked as read.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Mark all notifications as read
router.patch('/read-all', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) throw error;
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
