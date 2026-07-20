/**
 * Layout: WiamStudio-Submit-Pending.html
 * API: GET review-status — SLA + stage list
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Check, Clock } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';

const StudioSubmitPendingScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const seriesId = useRoute().params?.seriesId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!seriesId) return;
    setLoading(true);
    try {
      const d = await studioEpisioApi.reviewStatus(seriesId);
      setData(d);
      if (d?.pipeline_state === 'needs_changes') {
        navigation.replace('StudioNeedsChanges', { seriesId });
      } else if (d?.pipeline_state === 'live') {
        navigation.replace('StudioLiveSuccess', { seriesId, title: d?.series?.title });
      }
    } finally {
      setLoading(false);
    }
  }, [seriesId, navigation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const series = data?.series;
  const stages = data?.stages || [];
  const sla = data?.sla_hours || 72;
  const left = data?.sla_remaining_hours ?? sla;
  const pct = Math.max(4, Math.min(100, ((sla - left) / sla) * 100));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('StudioHome')}>
          <ChevronLeft size={15} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.h1}>Series Status</Text>
      </View>

      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <View style={styles.hero}>
            <View style={styles.pulse}>
              <Clock size={20} color={COLORS.navy} />
            </View>
            <Text style={styles.heroTitle}>With the WiamEpisio team</Text>
            <Text style={styles.heroText}>
              <Text style={{ fontFamily: FONTS.bold, color: '#fff' }}>{series?.title || 'Your series'}</Text>
              {' '}is with our team. We’re checking your trailer and every episode. When it clears, the WiamEpisio team publishes it for viewers — not you.
            </Text>
          </View>

          <View style={styles.slaCard}>
            <View style={styles.slaRow}>
              <Text style={styles.slaLbl}>Review window</Text>
              <Text style={styles.slaTimer}>{left.toFixed(1)}h left</Text>
            </View>
            <View style={styles.slaBar}><View style={[styles.slaFill, { width: `${pct}%` }]} /></View>
            <View style={styles.slaRow}>
              <Text style={styles.slaLbl}>Submitted</Text>
              <Text style={styles.slaLbl}>{sla}h SLA</Text>
            </View>
            {data?.timing ? (
              <Text style={[styles.slaLbl, { marginTop: 8, lineHeight: 16 }]}>
                Machines check trailer + every episode in ~{data.timing.compute_hours_estimate}h compute.
                Your wait promise is up to {sla}h (queue + human borderline) — not days per file.
              </Text>
            ) : null}
          </View>

          <View style={styles.stageList}>
            {stages.map((s) => (
              <View key={s.key} style={styles.stage}>
                <View style={[
                  styles.dot,
                  s.status === 'done' && styles.dotDone,
                  s.status === 'active' && styles.dotActive,
                ]}>
                  {s.status === 'done' ? <Check size={12} color={COLORS.navy} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stageTitle}>{s.title}</Text>
                  <Text style={styles.stageDetail}>{s.detail}</Text>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.ghost} onPress={() => navigation.navigate('StudioHome')}>
            <Text style={styles.ghostText}>Back to WiamStudio</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  h1: { fontFamily: FONTS.extraBold, color: '#fff', fontSize: 16 },
  hero: { alignItems: 'center', paddingVertical: 20, marginBottom: 8 },
  pulse: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
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
  slaBar: { height: 6, borderRadius: 4, backgroundColor: COLORS.navySoft || '#161634', overflow: 'hidden', marginBottom: 8 },
  slaFill: { height: '100%', backgroundColor: COLORS.gold },
  stageList: { gap: 14, marginBottom: 24 },
  stage: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  dot: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.navyLine,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  dotDone: { backgroundColor: '#3DDC97', borderColor: '#3DDC97' },
  dotActive: { borderColor: COLORS.gold, backgroundColor: 'rgba(212,160,23,0.2)' },
  stageTitle: { fontFamily: FONTS.bold, color: '#fff', fontSize: 13 },
  stageDetail: { marginTop: 2, fontFamily: FONTS.regular, color: COLORS.textFaint, fontSize: 11.5 },
  ghost: {
    padding: 15, borderRadius: 16, backgroundColor: COLORS.navyCard,
    borderWidth: 1, borderColor: COLORS.navyLine, alignItems: 'center',
  },
  ghostText: { fontFamily: FONTS.bold, color: '#C9C9DE', fontSize: 13.5 },
});

export default StudioSubmitPendingScreen;
