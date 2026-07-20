/**
 * Exact layout: WiamStudio-Season-Lock-Confirm.html
 * API: POST /creator/studio/series/:id/lock { confirm: true }
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Lock, AlertTriangle, Check } from 'lucide-react-native';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import resolveUrl from '../../utils/resolveUrl';

const StudioSeasonLockScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const seriesId = useRoute().params?.seriesId;
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!seriesId) return;
    setLoading(true);
    try {
      const d = await studioEpisioApi.getSeries(seriesId);
      setSeries(d?.series);
      if (d?.series?.season_locked) {
        navigation.replace('StudioCompleteness', { seriesId });
      }
    } catch (e) {
      Alert.alert('Season lock', e?.message || 'Could not load series');
    } finally {
      setLoading(false);
    }
  }, [seriesId, navigation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const lock = async () => {
    if (!checked) {
      Alert.alert('Confirm first', 'Check the box to confirm this is the complete story.');
      return;
    }
    setBusy(true);
    try {
      await studioEpisioApi.lockSeason(seriesId, { confirm: true, rights_confirmed: true });
      navigation.replace('StudioSoftInterest', { seriesId });
    } catch (e) {
      Alert.alert('Cannot lock yet', e?.data?.message || e?.message || 'Finish all gates first.');
      navigation.navigate('StudioCompleteness', { seriesId });
    } finally {
      setBusy(false);
    }
  };

  const planned = series?.planned_episode_count || 0;
  const ready = series?.ready_episodes || 0;
  const poster = resolveUrl(series?.poster_url || series?.cover_url);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={15} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.h1}>Confirm Complete Season</Text>
      </View>

      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <>
          <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 20 }}>
            <View style={styles.hero}>
              <View style={styles.lockIcon}>
                <Lock size={28} color={COLORS.gold} />
              </View>
              <Text style={styles.heroTitle}>Is this the complete story?</Text>
              <Text style={styles.heroSub}>
                Once you lock this season,{' '}
                <Text style={{ color: '#fff', fontFamily: FONTS.bold }}>you cannot edit or remove episodes</Text>
                . This keeps every promise WiamEpisio makes to viewers — every series here has an ending.
              </Text>
            </View>

            <View style={styles.seriesCard}>
              {poster ? (
                <Image source={{ uri: poster }} style={styles.poster} />
              ) : (
                <View style={styles.poster} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.seriesTitle}>{series?.title || 'Series'}</Text>
                <Text style={styles.seriesSub}>
                  <Text style={{ color: COLORS.gold, fontFamily: FONTS.bold }}>{ready} of {planned}</Text>
                  {' '}episodes uploaded · Trailer {series?.trailer_qa_status === 'passed' ? 'passed' : series?.trailer_qa_status || 'pending'}
                </Text>
              </View>
            </View>

            <View style={styles.warningCard}>
              <View style={styles.warningTitle}>
                <AlertTriangle size={16} color="#E4573D" />
                <Text style={styles.warningTitleText}>This cannot be undone</Text>
              </View>
              <Text style={styles.warningItem}>No new episodes can be added to this season after locking</Text>
              <Text style={styles.warningItem}>Existing episodes can't be replaced or removed directly</Text>
              <Text style={styles.warningItem}>Fixes only happen through a Revision Request, reviewed on just the change</Text>
            </View>

            <View style={styles.afterCard}>
              <Text style={styles.afterTitle}>After locking</Text>
              <Text style={styles.afterItem}>Your season enters full QC — trailer + every episode + cover/banner — then founder publishes on the website</Text>
              <Text style={styles.afterItem}>Earnings only begin once it's live</Text>
            </View>

            <TouchableOpacity
              style={[styles.confirmField, checked && styles.confirmChecked]}
              onPress={() => setChecked((v) => !v)}
              activeOpacity={0.85}
            >
              <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                {checked ? <Check size={13} color={COLORS.navy} strokeWidth={3} /> : null}
              </View>
              <Text style={styles.confirmText}>
                I confirm all <Text style={{ fontFamily: FONTS.bold, color: '#fff' }}>{planned} episodes</Text>
                {' '}are uploaded and this is the{' '}
                <Text style={{ fontFamily: FONTS.bold, color: '#fff' }}>complete story</Text>, start to finish.
              </Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <EpisioGoldButton
              label="Lock Season & Continue"
              onPress={lock}
              loading={busy}
              disabled={!checked}
            />
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.btnCancel}>Not yet — I need to add more episodes</Text>
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
  scroll: { flex: 1, paddingHorizontal: 20 },
  hero: { alignItems: 'center', paddingTop: 10, paddingBottom: 22 },
  lockIcon: {
    width: 66, height: 66, borderRadius: 33, backgroundColor: 'rgba(212,160,23,0.14)',
    borderWidth: 1.5, borderColor: 'rgba(212,160,23,0.4)', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  heroTitle: { fontSize: 18, fontFamily: FONTS.extraBold, color: '#fff', marginBottom: 8 },
  heroSub: { fontSize: 12, color: COLORS.textDim, lineHeight: 20, textAlign: 'center', maxWidth: 290, fontFamily: FONTS.regular },
  seriesCard: {
    flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: COLORS.navyCard,
    borderWidth: 1, borderColor: COLORS.navyLine, borderRadius: 16, padding: 14, marginBottom: 20,
  },
  poster: { width: 48, height: 69, borderRadius: 9, backgroundColor: COLORS.navySoft },
  seriesTitle: { fontSize: 13.5, fontFamily: FONTS.extraBold, color: '#fff', marginBottom: 4 },
  seriesSub: { fontSize: 11, color: COLORS.textDim, fontFamily: FONTS.regular },
  warningCard: {
    backgroundColor: 'rgba(228,87,61,0.08)', borderWidth: 1, borderColor: 'rgba(228,87,61,0.28)',
    borderRadius: 16, padding: 16, marginBottom: 16,
  },
  warningTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  warningTitleText: { fontSize: 12.5, fontFamily: FONTS.extraBold, color: '#fff' },
  warningItem: { fontSize: 11.5, color: '#E0A79A', lineHeight: 18, marginBottom: 8, fontFamily: FONTS.regular },
  afterCard: {
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 16, padding: 15, marginBottom: 24,
  },
  afterTitle: {
    fontSize: 12, fontFamily: FONTS.extraBold, color: COLORS.textDim,
    letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10,
  },
  afterItem: { fontSize: 11.5, color: '#D9D9E8', lineHeight: 18, marginBottom: 9, fontFamily: FONTS.regular },
  confirmField: {
    backgroundColor: COLORS.navyCard, borderWidth: 1.5, borderColor: COLORS.navyLine,
    borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  confirmChecked: { borderColor: COLORS.gold, backgroundColor: 'rgba(212,160,23,0.08)' },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.navyLine,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  confirmText: { flex: 1, fontSize: 12, color: '#E7E7F2', lineHeight: 18, fontFamily: FONTS.regular },
  footer: { paddingHorizontal: 20, paddingTop: 14 },
  btnLock: {
    width: '100%', paddingVertical: 16, borderRadius: 16, backgroundColor: COLORS.gold,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8,
  },
  btnLockText: { fontSize: 15, fontFamily: FONTS.extraBold, color: COLORS.navy },
  btnCancel: { textAlign: 'center', color: COLORS.textDim, fontFamily: FONTS.semi, fontSize: 12.5, paddingVertical: 13 },
});

export default StudioSeasonLockScreen;
