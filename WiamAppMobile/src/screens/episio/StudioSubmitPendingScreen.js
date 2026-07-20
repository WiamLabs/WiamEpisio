/**
 * Layout: WiamStudio-Submit-Pending.html
 * API: GET review-status — SLA + stage list
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Check, Clock } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';

const StudioSubmitPendingScreen = () => {
  const navigation = useNavigation();
  const seriesId = useRoute().params?.seriesId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef(null);

  const load = useCallback(async (soft = false) => {
    if (!seriesId) return;
    if (!soft) setLoading(true);
    try {
      const d = await studioEpisioApi.reviewStatus(seriesId);
      setData(d);
      if (d?.pipeline_state === 'needs_changes') {
        navigation.replace('StudioNeedsChanges', { seriesId });
      } else if (d?.pipeline_state === 'live') {
        navigation.replace('StudioLiveSuccess', {
          seriesId,
          title: d?.series?.title,
          autoPublished: !!d?.auto_published,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [seriesId, navigation]);

  useFocusEffect(useCallback(() => {
    load();
    timer.current = setInterval(() => load(true), 30000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]));

  const series = data?.series;
  const stages = data?.stages || [];
  const sla = data?.sla_hours || 72;
  const left = data?.sla_remaining_hours ?? sla;
  const pct = Math.max(4, Math.min(100, ((sla - left) / sla) * 100));
  const hours = Math.floor(left);
  const mins = Math.max(0, Math.round((left - hours) * 60));

  const defaultStages = stages.length ? stages : [
    { key: 'submitted', title: 'Submitted for review', detail: 'Received by the WiamEpisio team', status: 'done' },
    { key: 'checking', title: 'Reviewer checking quality gates', detail: 'In progress', status: 'active' },
    { key: 'decision', title: 'Decision — Live or Needs Changes', detail: 'Pending', status: 'pending' },
  ];

  return (
    <EpisioScreenShell
      title="Series Status"
      subtitle={series?.title || 'In review'}
      onBack={() => navigation.navigate('StudioHome')}
      footer={(
        <EpisioGoldButton
          label="Open Series Dashboard"
          onPress={() => navigation.navigate('StudioDashboard', { seriesId })}
          variant="ghost"
        />
      )}
    >
      {loading && !data ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <>
          <View style={styles.hero}>
            <View style={styles.pulseRing}>
              <View style={styles.pulse}>
                <Clock size={20} color={COLORS.navy} />
              </View>
            </View>
            <Text style={styles.heroTitle}>In Review Queue</Text>
            <Text style={styles.heroText}>
              <Text style={{ fontFamily: FONTS.bold, color: '#fff' }}>{series?.title || 'Your series'}</Text>
              {' '}is with our review team. You'll get a notification the moment there's an update.
            </Text>
          </View>

          <View style={styles.slaCard}>
            <View style={styles.slaRow}>
              <Text style={styles.slaLbl}>Review window</Text>
              <Text style={styles.slaTimer}>{hours}h {mins}m left</Text>
            </View>
            <View style={styles.slaBar}><View style={[styles.slaFill, { width: `${pct}%` }]} /></View>
            <View style={styles.slaRow}>
              <Text style={styles.slaLbl}>Submitted</Text>
              <Text style={styles.slaLbl}>{sla}h SLA</Text>
            </View>
            {data?.timing ? (
              <Text style={[styles.slaLbl, { marginTop: 8, lineHeight: 16 }]}>
                Machines check trailer + every episode in ~{data.timing.compute_hours_estimate}h compute.
                Your wait promise is up to {sla}h.
              </Text>
            ) : null}
          </View>

          <View style={styles.stageList}>
            {defaultStages.map((s) => (
              <View key={s.key} style={styles.stage}>
                <View style={[
                  styles.dot,
                  s.status === 'done' && styles.dotDone,
                  s.status === 'active' && styles.dotActive,
                ]}
                >
                  {s.status === 'done' ? <Check size={12} color={COLORS.navy} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stageTitle}>{s.title}</Text>
                  <Text style={styles.stageDetail}>{s.detail}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.lockNote}>
            <Text style={styles.lockText}>
              Published fields are locked while in review. You can still edit unsubmitted drafts on other series.
            </Text>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('StudioHome')}>
            <Text style={styles.withdraw}>Back to WiamStudio</Text>
          </TouchableOpacity>
        </>
      )}
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 12, marginBottom: 8 },
  pulseRing: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 2,
    borderColor: 'rgba(212,160,23,0.35)', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  pulse: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontFamily: FONTS.extraBold, color: '#fff', fontSize: 20, marginBottom: 10 },
  heroText: {
    textAlign: 'center', color: COLORS.textDim, fontFamily: FONTS.regular,
    fontSize: 13, lineHeight: 20, paddingHorizontal: 8,
  },
  slaCard: {
    backgroundColor: COLORS.navyCard, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: COLORS.navyLine, marginBottom: 18,
  },
  slaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  slaLbl: { color: COLORS.textDim, fontFamily: FONTS.regular, fontSize: 11.5 },
  slaTimer: { color: COLORS.gold, fontFamily: FONTS.bold, fontSize: 12 },
  slaBar: { height: 6, borderRadius: 4, backgroundColor: COLORS.navySoft, overflow: 'hidden', marginBottom: 8 },
  slaFill: { height: '100%', backgroundColor: COLORS.gold },
  stageList: { gap: 14, marginBottom: 18 },
  stage: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  dot: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.navyLine,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  dotDone: { backgroundColor: '#3DDC97', borderColor: '#3DDC97' },
  dotActive: { borderColor: COLORS.gold, backgroundColor: 'rgba(212,160,23,0.2)' },
  stageTitle: { fontFamily: FONTS.bold, color: '#fff', fontSize: 13 },
  stageDetail: { marginTop: 2, fontFamily: FONTS.regular, color: COLORS.textFaint, fontSize: 11.5 },
  lockNote: {
    backgroundColor: COLORS.navyCard, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: COLORS.navyLine, marginBottom: 16,
  },
  lockText: { fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 11.5, lineHeight: 17 },
  withdraw: {
    textAlign: 'center', color: COLORS.textFaint, fontFamily: FONTS.semi, fontSize: 12, paddingVertical: 8,
  },
});

export default StudioSubmitPendingScreen;
