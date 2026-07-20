/**
 * Layout: WiamStudio-Completeness-Gate.html
 * Data: GET /creator/studio/series/:id/completeness — full season gates
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Check, X } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';

const StudioCompletenessScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const seriesId = useRoute().params?.seriesId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!seriesId) return;
    setLoading(true);
    try {
      setData(await studioEpisioApi.completeness(seriesId));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [seriesId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const gates = data?.gates || [];
  const green = data?.gates_green || 0;
  const total = data?.gates_total || gates.length || 1;
  const canSubmit = !!data?.can_submit;
  const canLock = !!data?.can_lock;
  const series = data?.series;
  const blocked = gates.find((g) => !g.ok);

  const onFix = (gate) => {
    if (!gate?.fix) return;
    if (gate.fix === 'lock') navigation.navigate('StudioSeasonLock', { seriesId });
    else if (gate.fix === 'soft_interest') navigation.navigate('StudioSoftInterest', { seriesId });
    else navigation.navigate('StudioSeriesDetail', { seriesId });
  };

  const primary = () => {
    if (canSubmit) navigation.navigate('StudioSubmitForLive', { seriesId });
    else if (canLock) navigation.navigate('StudioSeasonLock', { seriesId });
    else if (blocked?.fix === 'soft_interest') navigation.navigate('StudioSoftInterest', { seriesId });
    else navigation.navigate('StudioSeriesDetail', { seriesId });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={15} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.h1}>Completeness Check</Text>
          <Text style={styles.sub}>{series?.title || 'Series'}</Text>
        </View>
      </View>

      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            <View style={styles.ringCard}>
              <Text style={styles.ringBig}>{green}/{total}</Text>
              <Text style={styles.ringLabel}>GATES GREEN</Text>
              <Text style={styles.ringTitle}>
                {canSubmit ? 'Ready to submit' : blocked ? 'Almost ready' : 'Keep building'}
              </Text>
              <Text style={styles.ringSub}>
                {canSubmit
                  ? 'All hard gates green — submit for system QC + founder publish'
                  : blocked
                    ? `Blocking: ${blocked.title}`
                    : 'Finish every planned episode, trailer, cover, and lock'}
              </Text>
            </View>

            {gates.map((g) => (
              <TouchableOpacity
                key={g.key}
                style={[styles.gateItem, !g.ok && styles.gateBlocked]}
                onPress={() => onFix(g)}
                disabled={g.ok || !g.fix}
              >
                <View style={[styles.gateIcon, g.ok ? styles.ok : styles.bad]}>
                  {g.ok ? <Check size={17} color="#fff" /> : <X size={17} color="#fff" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.gateTitle}>{g.title}</Text>
                  <Text style={[styles.gateSub, !g.ok && styles.gateSubBad]}>{g.detail}</Text>
                </View>
                {!g.ok && g.fix ? <Text style={styles.fix}>Fix →</Text> : null}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={[styles.btn, !canSubmit && !canLock && styles.btnMuted]}
              onPress={primary}
            >
              <Text style={styles.btnText}>
                {canSubmit ? 'Submit for Live' : canLock ? 'Lock complete season' : 'Fix blocking items'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.note}>
              System QC checks trailer + every episode + cover/banner. Founder publishes on the website.
            </Text>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  h1: { fontSize: 16, fontFamily: FONTS.extraBold, color: '#fff' },
  sub: { fontSize: 10.5, color: COLORS.textFaint, fontFamily: FONTS.semi, marginTop: 1 },
  ringCard: {
    backgroundColor: COLORS.navyCard, borderRadius: 18, borderWidth: 1, borderColor: COLORS.navyLine,
    padding: 22, alignItems: 'center', marginBottom: 18,
  },
  ringBig: { fontSize: 32, fontFamily: FONTS.extraBold, color: COLORS.gold },
  ringLabel: { fontSize: 10, color: COLORS.textFaint, fontFamily: FONTS.bold, letterSpacing: 1, marginTop: 4 },
  ringTitle: { marginTop: 12, fontSize: 16, fontFamily: FONTS.extraBold, color: '#fff' },
  ringSub: { marginTop: 6, fontSize: 12, color: COLORS.textDim, textAlign: 'center', lineHeight: 18, fontFamily: FONTS.regular },
  gateItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine, marginBottom: 10,
  },
  gateBlocked: { borderColor: 'rgba(228,87,61,0.4)' },
  gateIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  ok: { backgroundColor: '#3BB273' },
  bad: { backgroundColor: '#E4573D' },
  gateTitle: { fontSize: 13, fontFamily: FONTS.bold, color: '#fff' },
  gateSub: { marginTop: 3, fontSize: 11.5, color: COLORS.textDim, fontFamily: FONTS.regular },
  gateSubBad: { color: '#E0A79A' },
  fix: { color: COLORS.gold, fontFamily: FONTS.bold, fontSize: 12 },
  footer: { paddingHorizontal: 20, paddingTop: 10 },
  btn: {
    backgroundColor: COLORS.gold, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 8,
  },
  btnMuted: { backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine },
  btnText: { fontFamily: FONTS.extraBold, color: COLORS.navy, fontSize: 15 },
  note: { textAlign: 'center', color: COLORS.textFaint, fontSize: 11, fontFamily: FONTS.regular, lineHeight: 16 },
});

export default StudioCompletenessScreen;
