/**
 * AIComingSoonScreen — Push 11.
 *
 * Reachable from Studio when a creator enables "AI tools" in Settings,
 * or via the Editor. AI is intentionally NOT shipping in Push 11 — we
 * defer the OpenAI / Claude / on-device cost decision until we have
 * real demand. This screen is the honest, polished "coming soon"
 * surface that sets the right expectations and captures interest.
 *
 * The "Notify me" button toggles ``ai_waitlist`` on CreatorSettings via
 * the existing PATCH /studio/settings endpoint so we have a list to
 * email when AI tools land.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Bot, Sparkles, BookOpen, Bell, Check, House } from 'lucide-react-native';
import { COLORS, FONTS, SPACING } from '../../../constants/theme';
import { STUDIO_COLORS } from '../../../constants/studioTheme';
import studioV2Api from '../../../api/studioV2';

const FEATURES = [
  {
    icon: Sparkles,
    title: 'Writing suggestions',
    body: 'Surface a stronger verb, untangle a knotted sentence, or suggest the next beat — without leaving the editor.',
  },
  {
    icon: BookOpen,
    title: 'Series reminders',
    body: "We'll keep track of who's named what across chapters and warn you when a name, age, or detail drifts.",
  },
  {
    icon: Bot,
    title: 'Reader-aware ideas',
    body: 'Anonymous patterns from your readers (where they pause, react, drop off) become gentle pointers, never prescriptions.',
  },
];

const AIComingSoonScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    studioV2Api.getSettings()
      .then((res) => {
        if (cancelled) return;
        const s = res?.settings || {};
        setJoined(!!s.ai_waitlist);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const join = async () => {
    if (busy || joined) return;
    setBusy(true);
    try {
      await studioV2Api.updateSettings({ ai_waitlist: true });
      setJoined(true);
    } catch {
      // silent — non-critical
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.headBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={COLORS.white} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Main')}>
          <House size={17} color={STUDIO_COLORS.accent} />
        </TouchableOpacity>
        <Text style={styles.headTitle}>AI in Studio</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroIconWrap}>
          <Bot size={36} color={STUDIO_COLORS.accent} />
        </View>
        <Text style={styles.heroTitle}>Smart, not loud.</Text>
        <Text style={styles.heroBody}>
          We&apos;re building an AI layer that helps you write — never one that
          writes for you. We&apos;ll roll it out gradually, and only when it
          earns its keep. No surprises, no auto-published chapters, ever.
        </Text>

        <View style={styles.featureCard}>
          {FEATURES.map((f, idx) => {
            const Icon = f.icon;
            return (
              <View key={`f-${idx}`} style={[styles.featureRow, idx > 0 && styles.featureRowBorder]}>
                <View style={styles.featureIconWrap}>
                  <Icon size={16} color={STUDIO_COLORS.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureBody}>{f.body}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.principleCard}>
          <Text style={styles.principleTitle}>Our promises</Text>
          <Principle text="We never train on your content." />
          <Principle text="AI suggestions are opt-in, never auto-applied." />
          <Principle text="You can turn it off completely from Settings." />
          <Principle text="If we ever add a paid tier, founders are grandfathered." />
        </View>

        {loading ? (
          <ActivityIndicator color={STUDIO_COLORS.accent} style={{ marginTop: SPACING.lg }} />
        ) : joined ? (
          <View style={styles.joinedRow}>
            <Check size={14} color={STUDIO_COLORS.accent} />
            <Text style={styles.joinedText}>You&apos;re on the waitlist — we&apos;ll email you the day it lands.</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.joinBtn} onPress={join} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : (
              <>
                <Bell size={14} color="#fff" />
                <Text style={styles.joinBtnText}>Notify me when AI lands</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const Principle = ({ text }) => (
  <View style={styles.principleRow}>
    <View style={styles.principleDot} />
    <Text style={styles.principleText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: STUDIO_COLORS.background },
  headBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: STUDIO_COLORS.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headTitle: { color: STUDIO_COLORS.textBright, fontSize: 16, fontWeight: '700' },
  scroll: { padding: SPACING.lg, paddingBottom: 120 },

  heroIconWrap: {
    width: 72, height: 72, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: STUDIO_COLORS.accentSoft,
    borderWidth: 1, borderColor: STUDIO_COLORS.accentBorder,
    alignSelf: 'flex-start',
  },
  heroTitle: {
    color: STUDIO_COLORS.textBright,
    fontFamily: FONTS.display,
    fontSize: 26, marginTop: SPACING.md,
  },
  heroBody: {
    color: COLORS.textSecondary, fontSize: 13, lineHeight: 20,
    marginTop: 8,
  },

  featureCard: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: 14,
    backgroundColor: STUDIO_COLORS.card,
    borderWidth: 1, borderColor: STUDIO_COLORS.border,
  },
  featureRow: { flexDirection: 'row', gap: 10, paddingVertical: 12 },
  featureRowBorder: { borderTopWidth: 1, borderTopColor: STUDIO_COLORS.border },
  featureIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: STUDIO_COLORS.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  featureTitle: { color: STUDIO_COLORS.textBright, fontSize: 14, fontWeight: '700' },
  featureBody: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2, lineHeight: 18 },

  principleCard: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: 14,
    backgroundColor: 'rgba(168,85,247,0.06)',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.18)',
  },
  principleTitle: { color: STUDIO_COLORS.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 8 },
  principleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 4 },
  principleDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: STUDIO_COLORS.accent, marginTop: 6,
  },
  principleText: { color: COLORS.text, fontSize: 13, flex: 1, lineHeight: 19 },

  joinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: SPACING.lg,
    paddingVertical: 14, borderRadius: 14,
    backgroundColor: STUDIO_COLORS.accent,
  },
  joinBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  joinedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: 999,
    backgroundColor: STUDIO_COLORS.accentSoft,
    borderWidth: 1, borderColor: STUDIO_COLORS.accentBorder,
    alignSelf: 'flex-start',
  },
  joinedText: { color: STUDIO_COLORS.accent, fontSize: 12, fontWeight: '600' },
});

export default AIComingSoonScreen;
