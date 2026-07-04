// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/referrals.js — Referral system
//
// Every user has a referral_code (auto-generated on signup, see
// migration 035). Sharing it earns a reward once the referred
// person actually completes something real — not just signs up —
// so this can't be gamed with fake accounts.
//
// Reward rule (Founding-Worker-style, matches Master Plan V4
// Section 4 loyalty philosophy):
//   Referred WORKER gets fully verified  -> referrer gets 1 free
//     month of Pro + referred worker also gets a "Referred" badge.
//   Referred CUSTOMER completes their first booking -> referrer
//     gets a small credit reward (reward_type = 'cash_credit').

import { Router } from 'express';
import { supabaseAdmin, verifyUserToken } from '../lib/supabaseAdmin.js';

const router = Router();

// Get my referral code + stats
router.get('/me', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);

    const { data: me } = await supabaseAdmin
      .from('users').select('referral_code').eq('id', user.id).single();

    const { data: referrals } = await supabaseAdmin
      .from('referrals')
      .select('id, status, reward_type, created_at, qualified_at, rewarded_at, referred_id, users:referred_id(full_name, avatar_url)')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false });

    const rewarded = (referrals || []).filter(r => r.status === 'rewarded').length;

    res.json({
      referralCode: me?.referral_code,
      shareLink: `https://wiamapp.com/join?ref=${me?.referral_code}`,
      totalReferred: referrals?.length || 0,
      totalRewarded: rewarded,
      referrals: referrals || [],
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Apply a referral code at signup — call right after account creation
router.post('/apply', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { referralCode } = req.body;
    if (!referralCode) return res.status(400).json({ error: 'referralCode is required.' });

    const { data: referrer } = await supabaseAdmin
      .from('users').select('id').eq('referral_code', referralCode.toUpperCase()).single();

    if (!referrer) return res.status(404).json({ error: 'Invalid referral code.' });
    if (referrer.id === user.id) return res.status(400).json({ error: 'You cannot refer yourself.' });

    // Prevent double-application
    const { data: existing } = await supabaseAdmin
      .from('referrals').select('id').eq('referred_id', user.id).maybeSingle();
    if (existing) return res.status(400).json({ error: 'A referral code has already been applied to this account.' });

    await supabaseAdmin.from('users').update({ referred_by: referrer.id }).eq('id', user.id);

    const { data: referral, error } = await supabaseAdmin
      .from('referrals')
      .insert({ referrer_id: referrer.id, referred_id: user.id, referral_code: referralCode.toUpperCase(), status: 'pending' })
      .select().single();

    if (error) throw error;

    await supabaseAdmin.from('notifications').insert({
      user_id: referrer.id,
      title: 'Someone joined with your code! 🎉',
      body: 'A new WiamApp member signed up using your referral link.',
      type: 'system',
      data: { referral_id: referral.id },
    });

    res.status(201).json(referral);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Internal: mark a referral as qualified + rewarded.
// Called from verification.js (worker verified) and bookings.js
// (customer's first completed booking) — not exposed publicly.
export async function qualifyReferral({ referredUserId, kind }) {
  const { data: referral } = await supabaseAdmin
    .from('referrals')
    .select('*')
    .eq('referred_id', referredUserId)
    .eq('status', 'pending')
    .maybeSingle();

  if (!referral) return;

  const rewardType = kind === 'worker_verified' ? 'free_month_pro' : 'cash_credit';

  await supabaseAdmin
    .from('referrals')
    .update({ status: 'rewarded', reward_type: rewardType, qualified_at: new Date().toISOString(), rewarded_at: new Date().toISOString() })
    .eq('id', referral.id);

  await supabaseAdmin.from('notifications').insert({
    user_id: referral.referrer_id,
    title: 'Referral reward unlocked! 🏆',
    body: kind === 'worker_verified'
      ? 'The worker you referred just got verified — you earned 1 free month of Pro.'
      : 'The customer you referred completed their first booking — you earned a reward credit.',
    type: 'system',
    data: { referral_id: referral.id, reward_type: rewardType },
  });
}

export default router;
