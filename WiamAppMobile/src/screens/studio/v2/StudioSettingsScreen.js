/**
 * StudioSettingsScreen — V2 Settings tab (Push 9).
 *
 * Lets the creator hide tools they don't use, switch the default unit
 * label (chapter / episode / part / scene) and opt into the V2 beta
 * gate. Also surfaces the Studio Pro entitlement and a manual "Replay
 * tour" affordance.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Crown, Sparkles, Layers, Calendar, Lock, Bot, Beaker, RotateCcw } from 'lucide-react-native';
import { COLORS, FONTS, SPACING } from '../../../constants/theme';
import { STUDIO_COLORS } from '../../../constants/studioTheme';
import studioV2Api from '../../../api/studioV2';
import StudioTourModal from './StudioTourModal';
import StudioBackHomeRow from '../../../components/studio/StudioBackHomeRow';

const UNIT_OPTIONS = ['chapter', 'episode', 'part', 'scene'];

const StudioSettingsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await studioV2Api.getSettings();
      setSettings(res?.settings || null);
      setIsPro(!!res?.is_pro);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const patch = async (delta) => {
    setSettings((prev) => ({ ...(prev || {}), ...delta }));
    try {
      const res = await studioV2Api.updateSettings(delta);
      if (res?.settings) setSettings(res.settings);
    } catch (e) {
      Alert.alert('Could not save', typeof e === 'string' ? e : 'Try again in a moment.');
      load();
    }
  };

  if (loading || !settings) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={STUDIO_COLORS.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={STUDIO_COLORS.accent}
          />
        }
      >
        <StudioBackHomeRow navigation={navigation} title="Settings" />
        <Text style={styles.heroTitle}>Settings</Text>
        <Text style={styles.heroSub}>Tune Studio so you only see the tools you actually use.</Text>

        {/* Pro banner */}
        {isPro ? (
          <View style={styles.proRow}>
            <Crown size={14} color={STUDIO_COLORS.pro} />
            <Text style={styles.proRowText}>You&apos;re on Studio Pro — every tool unlocked.</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.upgradeRow} onPress={() => navigation.navigate('StudioProPaywall')}>
            <Crown size={14} color={STUDIO_COLORS.pro} />
            <Text style={styles.upgradeRowText}>Upgrade to Studio Pro</Text>
          </TouchableOpacity>
        )}

        {/* Default content unit */}
        <SectionCard title="Default content unit" icon={<Sparkles size={14} color={STUDIO_COLORS.accent} />}>
          <Text style={styles.cardSub}>What do you call a single piece of content?</Text>
          <View style={styles.pillRow}>
            {UNIT_OPTIONS.map((u) => (
              <TouchableOpacity
                key={`unit-${u}`}
                onPress={() => patch({ default_unit_label: u })}
                style={[
                  styles.pill,
                  settings.default_unit_label === u && styles.pillActive,
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    settings.default_unit_label === u && styles.pillTextActive,
                  ]}
                >
                  {u.charAt(0).toUpperCase() + u.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </SectionCard>

        {/* Tool visibility */}
        <SectionCard title="Tools I want to see" icon={<Layers size={14} color={STUDIO_COLORS.accent} />}>
          <Toggle
            icon={<Layers size={14} color={STUDIO_COLORS.accent} />}
            label="Series"
            sub="Group books into a reading order."
            value={settings.show_series}
            onChange={(v) => patch({ show_series: v })}
          />
          <Toggle
            icon={<Sparkles size={14} color={STUDIO_COLORS.accent} />}
            label="Universes"
            sub="Hold multiple series under one roof."
            value={settings.show_universes}
            onChange={(v) => patch({ show_universes: v })}
          />
          <Toggle
            icon={<Sparkles size={14} color={STUDIO_COLORS.accent} />}
            label="Arcs"
            sub="Slice a long story into named arcs."
            value={settings.show_arcs}
            onChange={(v) => patch({ show_arcs: v })}
          />
          <Toggle
            icon={<Calendar size={14} color={STUDIO_COLORS.accent} />}
            label="Scheduling"
            sub="Queue chapters to publish in the future."
            value={settings.show_scheduling}
            onChange={(v) => patch({ show_scheduling: v })}
          />
          <Toggle
            icon={<Lock size={14} color={STUDIO_COLORS.accent} />}
            label="Premium locking"
            sub="Lock chapters behind premium / coins."
            value={settings.show_premium_lock}
            onChange={(v) => patch({ show_premium_lock: v })}
          />
          <Toggle
            icon={<Bot size={14} color={STUDIO_COLORS.accent} />}
            label="AI tools"
            sub="Writing suggestions and reminders (coming soon)."
            value={settings.show_ai_tools}
            onChange={(v) => patch({ show_ai_tools: v })}
          />
          {settings.show_ai_tools ? (
            <TouchableOpacity
              style={styles.aiPreviewBtn}
              onPress={() => navigation.navigate('AIComingSoon')}
            >
              <Bot size={12} color={STUDIO_COLORS.accent} />
              <Text style={styles.aiPreviewText}>Preview AI roadmap & join waitlist</Text>
            </TouchableOpacity>
          ) : null}
        </SectionCard>

        {/* Notifications */}
        <SectionCard title="Notifications" icon={<Calendar size={14} color={STUDIO_COLORS.accent} />}>
          <Toggle
            icon={<Calendar size={14} color={STUDIO_COLORS.accent} />}
            label="Scheduled publish notifications"
            sub="Tell me when a scheduled chapter goes live."
            value={settings.notif_scheduled_publish}
            onChange={(v) => patch({ notif_scheduled_publish: v })}
          />
        </SectionCard>

        {/* Beta gate */}
        <SectionCard title="Beta program" icon={<Beaker size={14} color={STUDIO_COLORS.accent} />}>
          <Toggle
            icon={<Beaker size={14} color={STUDIO_COLORS.accent} />}
            label="Studio V2 beta"
            sub="Try the next-generation studio early. We may iterate quickly."
            value={settings.beta_studio_v2}
            onChange={(v) => patch({ beta_studio_v2: v })}
          />
        </SectionCard>

        {/* Tour */}
        <TouchableOpacity style={styles.tourBtn} onPress={() => setTourOpen(true)}>
          <RotateCcw size={14} color={STUDIO_COLORS.accent} />
          <Text style={styles.tourBtnText}>Replay welcome tour</Text>
        </TouchableOpacity>
      </ScrollView>

      <StudioTourModal visible={tourOpen} onClose={() => setTourOpen(false)} />
    </View>
  );
};

const SectionCard = ({ title, icon, children }) => (
  <View style={styles.card}>
    <View style={styles.cardHead}>
      {icon}
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

const Toggle = ({ icon, label, sub, value, onChange }) => (
  <View style={styles.toggleRow}>
    <View style={styles.toggleIcon}>{icon}</View>
    <View style={{ flex: 1 }}>
      <Text style={styles.toggleLabel}>{label}</Text>
      {sub ? <Text style={styles.toggleSub}>{sub}</Text> : null}
    </View>
    <Switch
      value={!!value}
      onValueChange={onChange}
      trackColor={{ true: STUDIO_COLORS.accent, false: 'rgba(255,255,255,0.1)' }}
      thumbColor="#fff"
    />
  </View>
);

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: STUDIO_COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: 140 },
  heroTitle: { color: STUDIO_COLORS.textBright, fontSize: 22, fontFamily: FONTS.display },
  heroSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 4, marginBottom: SPACING.md },

  proRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: 999,
    backgroundColor: STUDIO_COLORS.proSoft,
    borderWidth: 1, borderColor: STUDIO_COLORS.proBorder,
    alignSelf: 'flex-start',
    marginBottom: SPACING.md,
  },
  proRowText: { color: STUDIO_COLORS.pro, fontSize: 12, fontWeight: '700' },
  upgradeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: 999,
    backgroundColor: STUDIO_COLORS.proSoft,
    borderWidth: 1, borderColor: STUDIO_COLORS.proBorder,
    alignSelf: 'flex-start',
    marginBottom: SPACING.md,
  },
  upgradeRowText: { color: STUDIO_COLORS.pro, fontSize: 12, fontWeight: '700' },

  card: {
    backgroundColor: STUDIO_COLORS.card,
    borderRadius: 14,
    borderWidth: 1, borderColor: STUDIO_COLORS.border,
    padding: SPACING.md,
    marginTop: SPACING.md,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  cardTitle: { color: STUDIO_COLORS.textBright, fontSize: 14, fontWeight: '700' },
  cardSub: { color: COLORS.textMuted, fontSize: 11, marginBottom: SPACING.sm },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: STUDIO_COLORS.border,
  },
  pillActive: {
    backgroundColor: STUDIO_COLORS.accentSoft,
    borderColor: STUDIO_COLORS.accentBorder,
  },
  pillText: { color: COLORS.textSecondary, fontSize: 12 },
  pillTextActive: { color: STUDIO_COLORS.accent, fontWeight: '700' },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: SPACING.sm,
  },
  toggleIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: STUDIO_COLORS.accentSoft,
  },
  toggleLabel: { color: STUDIO_COLORS.textBright, fontSize: 13, fontWeight: '600' },
  toggleSub: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },

  tourBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start',
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: 999,
    borderWidth: 1, borderColor: STUDIO_COLORS.border,
    backgroundColor: STUDIO_COLORS.card,
  },
  tourBtnText: { color: STUDIO_COLORS.accent, fontSize: 12, fontWeight: '700' },

  aiPreviewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    marginTop: 6, marginLeft: 38,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: STUDIO_COLORS.accentSoft,
  },
  aiPreviewText: { color: STUDIO_COLORS.accent, fontSize: 11, fontWeight: '700' },
});

export default StudioSettingsScreen;
