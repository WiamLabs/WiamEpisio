/**
 * Series workspace hub (inventory H07 dashboard actions).
 * Pipeline: Cover → Banner → Trailer → Episodes → Completeness → Lock → Soft → Submit
 * Review states route to SubmitPending / NeedsChanges / LiveSuccess.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Lock, Check } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import QualityRejectedBanner from '../../components/episio/QualityRejectedBanner';
import resolveUrl from '../../utils/resolveUrl';

const StudioSeriesDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const seriesId = route.params?.seriesId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!seriesId) return;
    setLoading(true);
    try {
      const d = await studioEpisioApi.getSeries(seriesId);
      setData(d);
      setError(null);
      const state = d?.series?.pipeline_state;
      if (state === 'in_review') {
        // Soft redirect only when opening from home with review focus
        if (route.params?.openReview) {
          navigation.replace('StudioSubmitPending', { seriesId });
        }
      } else if (state === 'needs_changes' && route.params?.openReview) {
        navigation.replace('StudioNeedsChanges', { seriesId });
      } else if (state === 'live' && route.params?.openReview) {
        navigation.replace('StudioLiveSuccess', { seriesId, title: d?.series?.title });
      }
    } catch (e) {
      setError(e?.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [seriesId, navigation, route.params?.openReview]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const run = async (key, fn) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      const message = e?.data?.message || e?.message || 'Action failed';
      setError(message);
      Alert.alert('Blocked', message);
    } finally {
      setBusy(null);
    }
  };

  const pickImage = async (kind) => {
    const { pickCroppedImage } = await import('../../utils/pickMedia');
    const uri = await pickCroppedImage(kind === 'banner' ? 'banner' : [2, 3]);
    if (!uri) return;
    if (kind === 'banner') {
      await run('banner', () => studioEpisioApi.uploadBanner(seriesId, uri));
    } else {
      await run('cover', () => studioEpisioApi.uploadCover(seriesId, uri));
    }
  };

  const series = data?.series;
  const readiness = data?.readiness;
  const locked = !!series?.season_locked;
  const fixOpen = !!series?.fix_window_open;
  const state = series?.pipeline_state || 'building';
  const poster = resolveUrl(series?.poster_url || series?.cover_url);
  const gatesGreen = readiness?.gates_green || 0;
  const gatesTotal = readiness?.gates_total || 0;

  const unit = series?.unit_label || (series?.structure_mode === 'season' ? 'season' : 'series');
  const hubActions = [
    { key: 'episodes', label: 'Episodes', detail: `${series?.ready_episodes || 0}/${series?.planned_episode_count || 0} ready · ${series?.final_episodes || 0} final`, onPress: () => navigation.navigate('StudioEpisodeList', { seriesId }) },
    { key: 'trailer', label: 'Trailer + QA', detail: `Status: ${series?.trailer_qa_status || 'none'}`, onPress: () => navigation.navigate('StudioTrailer', { seriesId }) },
    { key: 'teaser', label: 'Teaser public preview', detail: 'How soft-interest viewers see you', onPress: () => navigation.navigate('StudioTeaserPreview', { seriesId }) },
    { key: 'cover', label: 'Cover (2:3)', detail: series?.cover_url ? 'Uploaded' : 'Required', onPress: () => navigation.navigate('StudioCover', { seriesId }), disabled: locked && !fixOpen },
    { key: 'banner', label: 'Banner / hero', detail: series?.banner_url ? 'Uploaded' : 'Add banner', onPress: () => navigation.navigate('StudioBanner', { seriesId }), disabled: locked && !fixOpen },
    { key: 'rights', label: 'Confirm rights', detail: series?.rights_confirmed ? 'Confirmed' : 'Required before lock', onPress: () => run('rights', () => studioEpisioApi.patchSeries(seriesId, { rights_confirmed: true })), busyKey: 'rights' },
    { key: 'complete', label: 'Completeness gate', detail: `${gatesGreen}/${gatesTotal} green`, onPress: () => navigation.navigate('StudioCompleteness', { seriesId }) },
    { key: 'lock', label: locked ? `${unit} locked ✓` : `Lock complete ${unit}`, detail: locked ? 'Before live: Needs Changes. After live: Revision Request (legal/rights/factual)' : 'Irreversible commitment to the WiamEpisio team', onPress: () => navigation.navigate('StudioSeasonLock', { seriesId }) },
    { key: 'soft', label: 'Soft interest', detail: 'Followers / Remind-me before our team spends review time', onPress: () => navigation.navigate('StudioSoftInterest', { seriesId }) },
    { key: 'submit', label: state === 'needs_changes' ? 'Resubmit to our team' : 'Submit for Live', detail: 'Our team reviews trailer + every episode, then publishes', onPress: () => navigation.navigate('StudioSubmitForLive', { seriesId }) },
    { key: 'revision', label: 'Revision Request (live only)', detail: 'Legal / rights / factual — scoped to one piece', onPress: () => navigation.navigate('StudioRevisionRequest', { seriesId }) },
    { key: 'analytics', label: 'Analytics', detail: 'After our team publishes', onPress: () => navigation.navigate('StudioAnalytics', { seriesId }) },
    { key: 'dashboard', label: 'Series dashboard', detail: state === 'live' ? 'Live stats' : 'Opens when live', onPress: () => navigation.navigate('StudioDashboard', { seriesId }) },
    { key: 'earnings', label: 'Earnings', detail: 'Empty until live', onPress: () => navigation.navigate('StudioEarnings', { seriesId }) },
    { key: 'help', label: 'Quality & review help', detail: 'Series vs Season · what our team checks', onPress: () => navigation.navigate('StudioHelpQuality') },
  ];

  return (
    <ScrollView style={[styles.root, { paddingTop: insets.top + 8 }]} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <ChevronLeft size={20} color={COLORS.text} />
      </TouchableOpacity>

      {loading ? <ActivityIndicator color={COLORS.gold} /> : (
        <>
          <View style={styles.hero}>
            {poster ? <Image source={{ uri: poster }} style={styles.poster} /> : <View style={styles.poster} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{series?.title || 'Series'}</Text>
              <Text style={styles.meta}>
                {series?.structure_mode === 'season' ? `Season ${series?.season_number || 1}` : 'Series'}
                {' · '}{series?.planned_episode_count || 0} eps · {series?.genre || 'Drama'}
              </Text>
              <View style={styles.statePill}>
                {locked ? <Lock size={11} color={COLORS.gold} /> : <Check size={11} color={COLORS.gold} />}
                <Text style={styles.stateText}>{String(state).replace('_', ' ').toUpperCase()}</Text>
              </View>
            </View>
          </View>

          {state === 'needs_changes' || series?.failed_episodes > 0 ? (
            <QualityRejectedBanner
              title={state === 'needs_changes' ? 'Changes required' : `${series?.failed_episodes} episode(s) rejected`}
              subtitle={state === 'needs_changes' ? 'Open fix list, then resubmit.' : 'Fix before lock / submit.'}
              onPress={() => navigation.navigate(
                state === 'needs_changes' ? 'StudioNeedsChanges' : 'StudioEpisodeList',
                { seriesId },
              )}
            />
          ) : null}

          {state === 'in_review' ? (
            <QualityRejectedBanner
              title="In review queue"
              subtitle="System QC + founder website check. You cannot publish yourself."
              ctaLabel="Status →"
              onPress={() => navigation.navigate('StudioSubmitPending', { seriesId })}
            />
          ) : null}

          <Text style={styles.section}>Workspace</Text>
          {hubActions.map((a) => (
            <TouchableOpacity
              key={a.key}
              style={[styles.action, a.disabled && styles.actionDisabled]}
              onPress={a.onPress}
              disabled={!!busy || a.disabled}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.actionText}>{a.label}</Text>
                <Text style={styles.actionDetail}>{a.detail}</Text>
              </View>
              {busy === a.busyKey ? <ActivityIndicator color={COLORS.navy} /> : null}
            </TouchableOpacity>
          ))}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  hero: { flexDirection: 'row', gap: 14, marginBottom: 16, alignItems: 'center' },
  poster: { width: 72, height: 102, borderRadius: 10, backgroundColor: COLORS.navyCard },
  title: { fontSize: 20, fontFamily: FONTS.extraBold, color: COLORS.text },
  meta: { marginTop: 4, color: COLORS.textDim, fontFamily: FONTS.regular, fontSize: 12.5 },
  statePill: {
    marginTop: 8, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(212,160,23,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  stateText: { fontFamily: FONTS.extraBold, color: COLORS.gold, fontSize: 10 },
  section: { marginTop: 6, marginBottom: 8, fontFamily: FONTS.bold, color: COLORS.textDim, fontSize: 12 },
  action: {
    marginTop: 8, backgroundColor: COLORS.navyCard, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.navyLine, flexDirection: 'row', alignItems: 'center',
  },
  actionDisabled: { opacity: 0.4 },
  actionText: { fontFamily: FONTS.bold, color: COLORS.text, fontSize: 14 },
  actionDetail: { marginTop: 3, fontFamily: FONTS.regular, color: COLORS.textFaint, fontSize: 11.5 },
  error: { marginTop: 14, color: COLORS.error, fontFamily: FONTS.medium },
});

export default StudioSeriesDetailScreen;
