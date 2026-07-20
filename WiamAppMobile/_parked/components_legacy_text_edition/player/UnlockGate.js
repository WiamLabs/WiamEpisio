/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Lock, Coins } from 'lucide-react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

/**
 * Unlock gate for episodes past free-first-N.
 * Server still enforces; this is UX only.
 */
const UnlockGate = ({
  episodeNumber,
  priceCoins = 10,
  freeEpisodeCount = 5,
  needLogin = false,
  onUnlock,
  onSignUp,
  onBack,
}) => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const handleUnlock = async () => {
    if (needLogin) {
      onSignUp?.();
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onUnlock?.();
    } catch (e) {
      setErr(typeof e === 'string' ? e : e?.message || 'Unlock failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Lock size={28} color={COLORS.secondary} />
        </View>
        <Text style={styles.title}>Episode {episodeNumber}</Text>
        <Text style={styles.body}>
          {needLogin
            ? `Episodes 1–${freeEpisodeCount} are free. Sign up to unlock more — we’ll give you coins to keep watching.`
            : `Episodes 1–${freeEpisodeCount} are free. Unlock this episode with WiamCoins to keep watching.`}
        </Text>
        {err ? <Text style={styles.err}>{err}</Text> : null}
        <TouchableOpacity
          style={styles.cta}
          onPress={handleUnlock}
          disabled={busy}
          activeOpacity={0.85}
        >
          {busy ? (
            <ActivityIndicator color="#08081a" />
          ) : needLogin ? (
            <Text style={styles.ctaText}>Sign up · get coins</Text>
          ) : (
            <>
              <Coins size={18} color="#08081a" />
              <Text style={styles.ctaText}>Unlock · {priceCoins} coins</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={onBack} style={styles.back}>
          <Text style={styles.backText}>Go back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,8,26,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(212,168,67,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 22,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  body: {
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  err: { color: COLORS.error, marginBottom: SPACING.sm, textAlign: 'center' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.secondary,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: RADIUS.md,
    minWidth: 200,
    justifyContent: 'center',
  },
  ctaText: { color: '#08081a', fontWeight: '800', fontSize: 15 },
  back: { marginTop: SPACING.md, padding: 8 },
  backText: { color: COLORS.textMuted, fontWeight: '600' },
});

export default UnlockGate;
