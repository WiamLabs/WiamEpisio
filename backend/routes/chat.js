// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/chat.js — AI Chat Moderation (Section 5B)
//
// Outgoing TEXT messages route through here instead of a direct
// Supabase insert from the mobile app — the one deliberate
// exception to "mobile calls Supabase directly for Realtime,"
// because the AI classification has to run BEFORE the message
// becomes visible to the other party, not after.
//
// Voice messages skip AI text classification (no transcription in
// MVP — documented as a known Phase 2 item) but still go through
// the same block-check and the same insert path, for consistency.
//
// SETUP REQUIRED: add at least one of GROQ_API_KEY, GEMINI_API_KEY,
// OPENROUTER_API_KEY, MISTRAL_API_KEY, or CEREBRAS_API_KEY to your
// Render environment variables — see the PROVIDERS block below for
// where to get each one. Without at least one, this endpoint fails
// closed (see classifyMessage's comment) — it does NOT silently
// let unmoderated messages through just because no key is set.

import { Router } from 'express';
import { supabaseAdmin, verifyUserToken } from '../lib/supabaseAdmin.js';
import { sendEmail } from '../lib/resend.js';

const router = Router();

/**
 * A blocked relationship goes both ways for messaging — mirrors
 * lib/api/messages.js's client-side check, but THIS is the
 * authoritative one. The client-side check is just a fast-fail UX
 * optimization; this is what actually decides.
 */
async function assertNotBlocked(senderId, receiverId) {
  const { data } = await supabaseAdmin
    .from('user_blocks')
    .select('id')
    .or(`and(blocker_id.eq.${senderId},blocked_id.eq.${receiverId}),and(blocker_id.eq.${receiverId},blocked_id.eq.${senderId})`)
    .maybeSingle();

  if (data) throw new Error("You can't message this person right now.");
}

// ============================================================
// MULTI-PROVIDER MODERATION — 5 free-tier providers rotated and
// chained as fallbacks, so no single provider's free quota becomes
// a single point of failure. Each provider has its own independent
// rate-limit pool, so spreading calls across all 5 multiplies the
// effective free daily capacity rather than just adding resilience.
//
// HOW IT WORKS: the starting provider round-robins on every call
// (so load is spread evenly, not hammering #1 until it's exhausted
// before ever touching #2-5). If the starting provider fails for
// ANY reason — missing key, network error, rate limit, malformed
// response — it falls through to the next one in the list. Only
// if every configured provider fails does the call fail closed.
//
// SETUP: add whichever of these you actually have, in your Render
// environment variables. You don't need all 5 — even one is enough
// to get started, more just means more combined free capacity and
// redundancy:
//   GROQ_API_KEY        — console.groq.com (no card)
//   GEMINI_API_KEY       — aistudio.google.com (no card)
//   OPENROUTER_API_KEY   — openrouter.ai (no card)
//   MISTRAL_API_KEY      — console.mistral.ai (no card, opts into
//                            data training on the free Experiment tier)
//   CEREBRAS_API_KEY      — cloud.cerebras.ai (no card, 1M free
//                            tokens/day, fastest of the 5)
//
// Verify current free-tier limits and model names before going
// live — these change often across all providers. The values below
// reflect each provider's documented free tier as of mid-2026.

function buildPrompt(text) {
  return `Classify this chat message between a customer and a worker on a service marketplace. Does it attempt to: (a) share a phone number in any disguised format, (b) suggest moving payment off-platform (cash, mobile money, bank transfer mentioned outside the app's payment flow), (c) suggest meeting or communicating outside the app. Respond with ONLY a JSON object, no other text: { "violation": true/false, "type": "phone"|"off_platform_payment"|"off_app_contact"|"none", "confidence": 0.0-1.0 }

Message: "${text.replace(/"/g, '\\"')}"`;
}

function parseClassification(rawText) {
  const cleaned = rawText.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned);
  return {
    violation: !!parsed.violation,
    type: parsed.type || 'none',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
  };
}

const PROVIDERS = [
  {
    name: 'groq',
    envKey: 'GROQ_API_KEY',
    async classify(text) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 100,
          messages: [{ role: 'user', content: buildPrompt(text) }],
        }),
      });
      if (!res.ok) throw new Error(`groq ${res.status}`);
      const data = await res.json();
      return parseClassification(data.choices?.[0]?.message?.content || '{}');
    },
  },
  {
    name: 'gemini',
    envKey: 'GEMINI_API_KEY',
    async classify(text) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: buildPrompt(text) }] }],
          }),
        }
      );
      if (!res.ok) throw new Error(`gemini ${res.status}`);
      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      return parseClassification(rawText);
    },
  },
  {
    name: 'openrouter',
    envKey: 'OPENROUTER_API_KEY',
    async classify(text) {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          max_tokens: 100,
          messages: [{ role: 'user', content: buildPrompt(text) }],
        }),
      });
      if (!res.ok) throw new Error(`openrouter ${res.status}`);
      const data = await res.json();
      return parseClassification(data.choices?.[0]?.message?.content || '{}');
    },
  },
  {
    name: 'mistral',
    envKey: 'MISTRAL_API_KEY',
    async classify(text) {
      const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          max_tokens: 100,
          messages: [{ role: 'user', content: buildPrompt(text) }],
        }),
      });
      if (!res.ok) throw new Error(`mistral ${res.status}`);
      const data = await res.json();
      return parseClassification(data.choices?.[0]?.message?.content || '{}');
    },
  },
  {
    name: 'cerebras',
    envKey: 'CEREBRAS_API_KEY',
    async classify(text) {
      const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.CEREBRAS_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama3.1-8b',
          max_tokens: 100,
          messages: [{ role: 'user', content: buildPrompt(text) }],
        }),
      });
      if (!res.ok) throw new Error(`cerebras ${res.status}`);
      const data = await res.json();
      return parseClassification(data.choices?.[0]?.message?.content || '{}');
    },
  },
];

// Round-robins which provider goes FIRST on each call, so the 5
// quotas drain evenly instead of always hitting #1 first. A simple
// module-level counter is fine here — one backend process, no need
// for anything fancier at this scale.
let rotationIndex = 0;

async function classifyMessage(text) {
  const configured = PROVIDERS.filter(p => !!process.env[p.envKey]);

  if (configured.length === 0) {
    // Fail CLOSED, not open. Zero configured providers must never
    // silently disable moderation — that would be worse than not
    // building this feature at all, since it would look like
    // protection that isn't actually there.
    throw new Error('MODERATION_UNAVAILABLE');
  }

  const startAt = rotationIndex % configured.length;
  rotationIndex++;

  const ordered = [...configured.slice(startAt), ...configured.slice(0, startAt)];

  let lastError;
  for (const provider of ordered) {
    try {
      return await provider.classify(text);
    } catch (err) {
      console.warn(`[chat moderation] ${provider.name} failed: ${err.message}`);
      lastError = err;
      // Fall through to the next provider in the chain
    }
  }

  // Every configured provider failed — fail closed, same as having
  // zero configured. This should be rare (it means all 5 free
  // quotas are simultaneously exhausted or down), but it must never
  // silently let an unmoderated message through.
  console.warn('[chat moderation] All providers failed:', lastError?.message);
  throw new Error('MODERATION_UNAVAILABLE');
}

/**
 * The 3-strike system (Section 5B). Strike 1 is invisible to the
 * other party. Strike 2 adds a formal warning email. Strike 3
 * auto-creates a fraud_reports entry for a human reviewer — the AI
 * is always a fast first filter, never the final judge.
 */
async function recordStrike(userId, moderationLogId) {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { count: recentStrikes } = await supabaseAdmin
    .from('user_strikes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', ninetyDaysAgo.toISOString());

  const strikeNumber = (recentStrikes || 0) + 1;

  await supabaseAdmin.from('user_strikes').insert({
    user_id: userId,
    strike_number: strikeNumber,
    reason: 'chat_moderation_violation',
    moderation_log_id: moderationLogId,
  });

  if (strikeNumber === 1) {
    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      title: 'A message you sent was held',
      body: 'All payments and contact must stay on WiamApp to keep both sides protected. Please don\'t try this again.',
      type: 'system',
    });
  } else if (strikeNumber === 2) {
    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      title: 'Formal warning — repeated policy violation',
      body: 'This is your second attempt to share contact details or move payment off WiamApp. A third will be reviewed by our team and may result in suspension.',
      type: 'system',
    });
    const { data: userRow } = await supabaseAdmin.from('users').select('email, full_name').eq('id', userId).single();
    if (userRow?.email) {
      await sendEmail({
        to: userRow.email,
        subject: 'WiamApp — Formal Warning',
        html: `<p>Hi ${userRow.full_name || ''},</p><p>We detected a second attempt to share contact details or arrange payment outside WiamApp in your chat messages. This protects both you and the other party — disputes and safety features only work for bookings made through the app.</p><p>A third occurrence within 90 days will be reviewed by our team and may result in account suspension.</p><p>— The WiamApp Team</p>`,
      });
    }
  } else if (strikeNumber >= 3) {
    const { data: fraudReport } = await supabaseAdmin
      .from('fraud_reports')
      .insert({
        reported_by: null,
        reported_user_id: userId,
        fraud_type: 'other',
        description: 'Automatic flag: 3rd chat moderation violation (off-platform payment/contact attempt) within 90 days. AI-detected, requires human review per Section 5B strike system.',
        status: 'open',
      })
      .select()
      .single();

    const { data: admins } = await supabaseAdmin.from('users').select('id').eq('role', 'admin');
    if (admins?.length) {
      await supabaseAdmin.from('notifications').insert(
        admins.map(a => ({
          user_id: a.id,
          title: 'Strike 3 — fraud review needed',
          body: 'A user has hit their 3rd chat moderation violation in 90 days. Review their chat history and decide: dismiss, warning, suspension, or ban.',
          type: 'system',
          data: { fraud_report_id: fraudReport?.id, flagged_user_id: userId },
        }))
      );
    }

    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      title: 'Account under review',
      body: 'Repeated policy violations have flagged your account for review by our team.',
      type: 'system',
    });
  }

  return strikeNumber;
}

router.post('/send', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { bookingId, receiverId, text } = req.body;

    if (!bookingId || !receiverId || !text?.trim()) {
      return res.status(400).json({ success: false, error: 'bookingId, receiverId, and text are required.' });
    }

    await assertNotBlocked(user.id, receiverId);

    let classification;
    try {
      classification = await classifyMessage(text);
    } catch (err) {
      if (err.message === 'MODERATION_UNAVAILABLE') {
        // Fail closed — see classifyMessage's comment. The sender
        // gets an honest reason, not a silently-dropped message.
        return res.status(503).json({
          success: false,
          error: 'Message moderation is temporarily unavailable. Please try again in a moment.',
        });
      }
      throw err;
    }

    // Always log the attempt — auditable either way, per Section 5B.
    const { data: logEntry } = await supabaseAdmin
      .from('chat_moderation_log')
      .insert({
        booking_id: bookingId,
        sender_id: user.id,
        original_text: text,
        violation_type: classification.type,
        confidence: classification.confidence,
        was_blocked: classification.violation && classification.confidence > 0.75,
      })
      .select()
      .single();

    if (classification.violation && classification.confidence > 0.75) {
      const strikeNumber = await recordStrike(user.id, logEntry?.id);

      // The held message itself is still inserted — as the system
      // notice, never the original text — so both sides see SOMETHING
      // happened in the conversation, exactly per Section 5B.
      const { data: noticeMsg } = await supabaseAdmin
        .from('messages')
        .insert({
          booking_id: bookingId,
          sender_id: user.id,
          receiver_id: receiverId,
          message: 'A message was held because it may have shared contact details or suggested payment outside WiamApp. All payments must go through WiamApp to keep both of you protected.',
          is_read: false,
        })
        .select()
        .single();

      return res.json({
        success: true,
        held: true,
        strikeNumber,
        data: noticeMsg,
      });
    }

    const { data: savedMsg, error } = await supabaseAdmin
      .from('messages')
      .insert({
        booking_id: bookingId,
        sender_id: user.id,
        receiver_id: receiverId,
        message: text,
        is_read: false,
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, held: false, data: savedMsg });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/send-voice', async (req, res) => {
  try {
    const user = await verifyUserToken(req.headers.authorization);
    const { bookingId, receiverId, voiceUrl } = req.body;

    if (!bookingId || !receiverId || !voiceUrl) {
      return res.status(400).json({ success: false, error: 'bookingId, receiverId, and voiceUrl are required.' });
    }

    await assertNotBlocked(user.id, receiverId);

    // No AI text classification for voice (no transcription in MVP
    // — Section 21B's documented Phase 2 item). Still logged so a
    // human reviewer can listen if either party files a dispute.
    const { data: savedMsg, error } = await supabaseAdmin
      .from('messages')
      .insert({
        booking_id: bookingId,
        sender_id: user.id,
        receiver_id: receiverId,
        voice_url: voiceUrl,
        is_read: false,
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, held: false, data: savedMsg });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
