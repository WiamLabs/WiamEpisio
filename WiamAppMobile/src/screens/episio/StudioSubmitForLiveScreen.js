/**
 * Layout: WiamStudio-Submit-For-Live.html (Screens 2 — lock copy)
 * API: POST submit-review — queues full-season QC; founder publishes on website
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Check, Clock, Lock, Coins } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import resolveUrl from '../../utils/resolveUrl';

const StudioSubmitForLiveScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const seriesId = useRoute().params?.seriesId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!seriesId) return;
    setLoading(true);
    try {
      setData(await studioEpisioApi.completeness(seriesId));
    } finally {
      setLoading(false);
    }
  }, [seriesId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const series = data?.series;
  const soft = data?.soft_interest || {};
  const poster = resolveUrl(series?.poster_url || series?.cover_url);

  const submit = async () => {
    setBusy(true);
    try {
      await studioEpisioApi.submitReview(seriesId);
      navigation.replace('StudioSubmitPending', { seriesId });
    } catch (e) {
      Alert.alert('Not ready', e?.data?.message || e?.message || 'Finish completeness gates first.');
      navigation.navigate('StudioCompleteness', { seriesId });
    } finally {
      setBusy(false);
    }
  };

  const rows = [
    { label: 'Episodes uploaded', value: `${series?.ready_episodes || 0} / ${series?.planned_episode_count || 0}` },
    { label: 'Trailer QA', value: series?.trailer_qa_status === 'passed' ? 'Pass' : (series?.trailer_qa_status || '—') },
    { label: 'Cover & metadata', value: 'Complete' },
    { label: 'Season locked', value: series?.season_locked ? 'Locked' : 'Not locked' },
    { label: 'Soft interest', value: `${soft.followers || 0} followers · ${soft.remind_count || 0} reminds` },
    { label: 'Full-season QC', value: 'Trailer + every episode + assets' },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={15} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.h1}>Submit for Live</Text>
          <Text style={styles.sub}>Final review before publishing</Text>
        </View>
      </View>

      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            <View style={styles.hero}>
              {poster ? <Image source={{ uri: poster }} style={styles.poster} /> : <View style={styles.poster} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{series?.title || 'Series'}</Text>
                <Text style={styles.meta}>
                  {series?.genre || 'Drama'} · {series?.planned_episode_count || 0} Episodes
                </Text>
              </View>
            </View>

            <Text style={styles.section}>Quality Summary</Text>
            <View style={styles.summary}>
              {rows.map((r) => (
                <View key={r.label} style={styles.row}>
                  <Check size={16} color="#3BB273" />
                  <Text style={styles.rowLabel}>{r.label}</Text>
                  <Text style={styles.rowVal}>{r.value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.flowCard}>
              <View style={styles.flowTitle}>
                <Clock size={15} color={COLORS.gold} />
                <Text style={styles.flowTitleText}>What happens next</Text>
              </View>
              <Text style={styles.flowText}>
                The system runs QC on <Text style={{ color: COLORS.gold, fontFamily: FONTS.bold }}>trailer + every episode + cover/banner</Text>
                {' '}(picture, sound, light, frame). Founder/team does a light final check on the{' '}
                <Text style={{ color: COLORS.gold, fontFamily: FONTS.bold }}>website</Text> and publishes for you.
              </Text>
            </View>

            <View style={[styles.flowCard, styles.lockCard]}>
              <View style={styles.flowTitle}>
                <Lock size={15} color="#E4573D" />
                <Text style={styles.flowTitleText}>This locks your season</Text>
              </View>
              <Text style={[styles.flowText, { color: '#E0A79A' }]}>
                After submitting, episodes <Text style={{ color: '#E4573D', fontFamily: FONTS.bold }}>cannot be edited or replaced</Text>.
                {' '}Fixes only through a Revision Request on the changed part.
              </Text>
            </View>

            <View style={styles.earnNote}>
              <Coins size={15} color={COLORS.textFaint} />
              <Text style={styles.earnText}>Earnings start when WiamEpisio publishes — not before.</Text>
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={[styles.btn, !data?.can_submit && styles.btnDisabled]}
              onPress={submit}
              disabled={busy || !data?.can_submit}
            >
              {busy ? (
                <ActivityIndicator color={COLORS.navy} />
              ) : (
                <Text style={styles.btnText}>Submit for Live</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.cancel}>Not yet — keep editing</Text>
            </TouchableOpacity>
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
  sub: { fontSize: 10.5, color: COLORS.textFaint, fontFamily: FONTS.semi },
  hero: {
    flexDirection: 'row', gap: 13, alignItems: 'center', backgroundColor: COLORS.navyCard,
    borderWidth: 1, borderColor: COLORS.navyLine, borderRadius: 16, padding: 14, marginBottom: 18,
  },
  poster: { width: 56, height: 82, borderRadius: 10, backgroundColor: COLORS.navySoft },
  title: { fontSize: 14.5, fontFamily: FONTS.extraBold, color: '#fff', marginBottom: 4 },
  meta: { fontSize: 11, color: COLORS.textDim, fontFamily: FONTS.regular },
  section: {
    fontSize: 12, fontFamily: FONTS.extraBold, color: COLORS.textDim,
    letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10,
  },
  summary: {
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 16, paddingHorizontal: 14, marginBottom: 20,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: COLORS.navyLine,
  },
  rowLabel: { flex: 1, fontSize: 12, color: '#E7E7F2', fontFamily: FONTS.regular },
  rowVal: { fontSize: 11.5, color: '#fff', fontFamily: FONTS.bold },
  flowCard: {
    backgroundColor: 'rgba(212,160,23,0.12)', borderWidth: 1, borderColor: 'rgba(212,160,23,0.28)',
    borderRadius: 16, padding: 16, marginBottom: 16,
  },
  lockCard: {
    borderColor: 'rgba(228,87,61,0.28)',
    backgroundColor: 'rgba(228,87,61,0.1)',
  },
  flowTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  flowTitleText: { fontSize: 12.5, fontFamily: FONTS.extraBold, color: '#fff' },
  flowText: { fontSize: 11.5, color: '#D9C89A', lineHeight: 18, fontFamily: FONTS.regular },
  earnNote: { flexDirection: 'row', gap: 10, paddingHorizontal: 2 },
  earnText: { flex: 1, fontSize: 11, color: COLORS.textDim, lineHeight: 17, fontFamily: FONTS.regular },
  footer: { paddingHorizontal: 20, paddingTop: 12 },
  btn: {
    backgroundColor: COLORS.gold, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 10,
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontFamily: FONTS.extraBold, color: COLORS.navy, fontSize: 15 },
  cancel: { textAlign: 'center', color: COLORS.textDim, fontFamily: FONTS.semi, fontSize: 12.5, paddingVertical: 12 },
});

export default StudioSubmitForLiveScreen;
