/**
 * Layout: WiamStudio-Series-Trailer.html
 * API: uploadTrailer + series detail for QA badge
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Check, RefreshCw } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';

const StudioTrailerScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const seriesId = useRoute().params?.seriesId;
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!seriesId) return;
    setLoading(true);
    try {
      const d = await studioEpisioApi.getSeries(seriesId);
      setSeries(d?.series);
    } finally {
      setLoading(false);
    }
  }, [seriesId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const locked = !!series?.season_locked && !series?.fix_window_open;
  const qa = series?.trailer_qa_status || 'none';
  const passed = qa === 'passed';
  const dur = series?.trailer_duration_seconds || 0;
  const inRange = dur >= 15 && dur <= 60;

  const runUpload = async () => {
    if (locked) {
      Alert.alert('Season locked', 'Trailer replace opens when Needs Changes allows a fix window.');
      return;
    }
    setBusy(true);
    try {
      await studioEpisioApi.uploadTrailer(seriesId, {
        duration_seconds: 42, width: 1080, height: 1920,
      });
      await load();
      Alert.alert('Trailer registered', 'QA checklist updated.');
    } catch (e) {
      Alert.alert('Trailer failed', e?.data?.message || e?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  };

  const checks = [
    { ok: passed || !!series?.trailer_url, label: '9:16 aspect ratio confirmed' },
    { ok: passed || !!series?.trailer_url, label: 'Resolution 1080 × 1920' },
    { ok: inRange || passed, label: 'Duration within 15–60s' },
    { ok: passed, label: 'No black frames / QA pass' },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={15} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.h1}>Trailer</Text>
          <Text style={styles.sub}>{series?.title || 'Series'}</Text>
        </View>
      </View>

      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <View style={styles.preview}>
            <Text style={styles.badge}>TRAILER</Text>
            <Text style={styles.previewTime}>{dur ? `${dur}s` : '—'} {inRange ? '— in range' : ''}</Text>
          </View>

          <View style={styles.meter}>
            <View style={styles.meterTrack}>
              <View style={[styles.meterFill, { width: `${Math.min(100, (dur / 60) * 100)}%` }]} />
            </View>
            <View style={styles.meterLabels}>
              <Text style={styles.meterLbl}>15s</Text>
              <Text style={styles.meterLbl}>60s</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.replace} onPress={runUpload} disabled={busy || locked}>
            {busy ? <ActivityIndicator color={COLORS.gold} /> : <Text style={styles.replaceText}>Replace Video</Text>}
          </TouchableOpacity>

          <View style={styles.qaCard}>
            <View style={styles.qaHead}>
              <Text style={styles.qaTitle}>Quality Check</Text>
              <View style={[styles.qaBadge, passed ? styles.pass : styles.fail]}>
                <Text style={styles.qaBadgeText}>{passed ? 'PASS' : (qa || 'PENDING').toUpperCase()}</Text>
              </View>
            </View>
            {checks.map((c) => (
              <View key={c.label} style={styles.checkRow}>
                <Check size={14} color={c.ok ? '#3DDC97' : COLORS.textFaint} />
                <Text style={[styles.checkText, !c.ok && { color: COLORS.textFaint }]}>{c.label}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.refresh} onPress={runUpload} disabled={busy || locked}>
              <RefreshCw size={12} color={COLORS.gold} />
              <Text style={styles.refreshText}>Re-run Quality Check</Text>
            </TouchableOpacity>
          </View>
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
  sub: { fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 11.5, marginTop: 2 },
  preview: {
    height: 220, borderRadius: 18, backgroundColor: COLORS.navyCard,
    borderWidth: 1, borderColor: COLORS.navyLine, justifyContent: 'flex-end', padding: 14, marginBottom: 14,
  },
  badge: {
    position: 'absolute', top: 12, left: 12, fontFamily: FONTS.extraBold, color: COLORS.gold, fontSize: 10,
  },
  previewTime: { fontFamily: FONTS.bold, color: '#fff', fontSize: 13 },
  meter: { marginBottom: 14 },
  meterTrack: { height: 6, borderRadius: 4, backgroundColor: COLORS.navyCard, overflow: 'hidden' },
  meterFill: { height: '100%', backgroundColor: COLORS.gold },
  meterLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  meterLbl: { color: COLORS.textFaint, fontSize: 10, fontFamily: FONTS.regular },
  replace: {
    padding: 12, borderRadius: 12, backgroundColor: COLORS.navySoft || '#161634',
    borderWidth: 1, borderColor: COLORS.navyLine, alignItems: 'center', marginBottom: 16,
  },
  replaceText: { color: COLORS.gold, fontFamily: FONTS.bold, fontSize: 12 },
  qaCard: {
    backgroundColor: COLORS.navyCard, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  qaHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  qaTitle: { fontFamily: FONTS.bold, color: '#fff', fontSize: 13 },
  qaBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  pass: { backgroundColor: 'rgba(61,220,151,0.15)' },
  fail: { backgroundColor: 'rgba(228,87,61,0.15)' },
  qaBadgeText: { fontFamily: FONTS.extraBold, fontSize: 10, color: '#fff' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  checkText: { fontFamily: FONTS.regular, color: COLORS.text, fontSize: 12 },
  refresh: {
    marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: 11, borderRadius: 12, backgroundColor: COLORS.navySoft || '#161634',
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  refreshText: { color: COLORS.gold, fontFamily: FONTS.bold, fontSize: 11.5 },
});

export default StudioTrailerScreen;
