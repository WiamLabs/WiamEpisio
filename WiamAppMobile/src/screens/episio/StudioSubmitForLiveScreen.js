/**
 * Layout: WiamStudio-Submit-For-Live.html (Screens 2 — lock copy)
 * API: POST submit-review — queues full-season QC; founder publishes on website
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Alert, Image, TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Check, X, Clock, Lock, Coins } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import resolveUrl from '../../utils/resolveUrl';

const StudioSubmitForLiveScreen = () => {
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
  const gates = data?.gates || [];
  const hasCover = !!series?.has_cover;
  const poster = hasCover ? resolveUrl(series?.poster_url || series?.cover_url) : null;

  const gateOk = (key) => {
    const hit = gates.find((g) => g.key === key);
    return hit ? !!hit.ok : null;
  };

  const coverOk = gateOk('cover') ?? hasCover;
  const metaOk = gateOk('metadata') ?? !!(series?.title && series?.genre && (series?.description || '').length >= 10);
  const trailerOk = gateOk('trailer') ?? series?.trailer_qa_status === 'passed';
  const epsOk = gateOk('episodes')
    ?? ((series?.ready_episodes || 0) >= (series?.planned_episode_count || 0) && (series?.planned_episode_count || 0) > 0);
  const lockOk = !!series?.season_locked;
  const softOk = true; // optional — never red on submit summary

  const rows = [
    {
      label: 'Episodes uploaded',
      value: `${series?.ready_episodes || 0} / ${series?.planned_episode_count || 0}`,
      ok: epsOk,
    },
    {
      label: 'Trailer QA',
      value: series?.trailer_qa_status === 'passed' ? 'Pass' : (series?.trailer_qa_status || '—'),
      ok: trailerOk,
    },
    {
      label: 'Cover (2:3)',
      value: coverOk ? 'Uploaded' : 'Missing',
      ok: coverOk,
    },
    {
      label: 'Synopsis & metadata',
      value: metaOk ? 'Complete' : 'Incomplete',
      ok: metaOk,
    },
    {
      label: 'Rights / season lock',
      value: lockOk ? 'Locked & signed' : 'Not locked',
      ok: lockOk,
    },
    {
      label: 'Soft interest (optional)',
      value: `${soft.followers || 0} followers · ${soft.remind_count || 0} reminds`,
      ok: softOk,
      optional: true,
    },
  ];

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

  return (
    <EpisioScreenShell
      title="Submit for Live"
      subtitle="Final review before publishing"
      footer={(
        <>
          <EpisioGoldButton
            label="Submit for Live"
            onPress={submit}
            loading={busy}
            disabled={!data?.can_submit}
          />
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingVertical: 12 }}>
            <Text style={styles.cancel}>Not yet — keep editing</Text>
          </TouchableOpacity>
        </>
      )}
    >
      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <>
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
            {rows.map((r, idx) => (
              <View key={r.label} style={[styles.row, idx === rows.length - 1 && { borderBottomWidth: 0 }]}>
                {r.ok ? (
                  <Check size={16} color="#3BB273" />
                ) : r.optional ? (
                  <Clock size={16} color={COLORS.textFaint} />
                ) : (
                  <X size={16} color="#E4573D" />
                )}
                <Text style={styles.rowLabel}>{r.label}</Text>
                <Text style={[styles.rowVal, !r.ok && !r.optional && { color: '#E0A79A' }]}>{r.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.flowCard}>
            <View style={styles.flowTitle}>
              <Clock size={15} color={COLORS.gold} />
              <Text style={styles.flowTitleText}>What happens next</Text>
            </View>
            <Text style={styles.flowText}>
              Our team reviews new series within{' '}
              <Text style={{ color: COLORS.gold, fontFamily: FONTS.bold }}>72 hours</Text>
              . If every gate above is green, it can also go live{' '}
              <Text style={{ color: COLORS.gold, fontFamily: FONTS.bold }}>automatically</Text>
              {' '}once the review window opens.
            </Text>
          </View>

          <View style={[styles.flowCard, styles.lockCard]}>
            <View style={styles.flowTitle}>
              <Lock size={15} color="#E4573D" />
              <Text style={styles.flowTitleText}>Submit queues QC</Text>
            </View>
            <Text style={[styles.flowText, { color: '#E0A79A' }]}>
              Your {series?.season_locked ? 'season is already locked. ' : ''}
              Submitting freezes further edits and starts full-season quality review.
              Pre-live fixes come through Needs Changes; after live, use a Revision Request.
            </Text>
          </View>

          <View style={styles.earnNote}>
            <Coins size={15} color={COLORS.textFaint} />
            <Text style={styles.earnText}>
              Earnings start counting from the moment your series goes live — not before.
            </Text>
          </View>
        </>
      )}
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
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
  earnNote: { flexDirection: 'row', gap: 10, paddingHorizontal: 2, marginBottom: 8 },
  earnText: { flex: 1, fontSize: 11, color: COLORS.textDim, lineHeight: 17, fontFamily: FONTS.regular },
  cancel: { textAlign: 'center', color: COLORS.textDim, fontFamily: FONTS.semi, fontSize: 12.5 },
});

export default StudioSubmitForLiveScreen;
