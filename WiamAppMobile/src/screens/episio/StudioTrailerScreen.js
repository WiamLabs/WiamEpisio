/**
 * Layout: WiamStudio-Series-Trailer.html
 * API: uploadTrailer + series detail for QA badge
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Alert, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Check, RefreshCw } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import { pickVideo } from '../../utils/pickMedia';

const StudioTrailerScreen = () => {
  const navigation = useNavigation();
  const seriesId = useRoute().params?.seriesId;
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pickedDur, setPickedDur] = useState(null);
  const [pickedName, setPickedName] = useState(null);

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
  const dur = pickedDur || series?.trailer_duration_seconds || 0;
  const inRange = dur >= 15 && dur <= 60;

  const pickAndUpload = async () => {
    if (locked) {
      Alert.alert('Season locked', 'Trailer replace opens when Needs Changes allows a fix window.');
      return;
    }
    const asset = await pickVideo();
    if (!asset) return;
    let seconds = 42;
    if (asset.duration) {
      seconds = asset.duration > 1000 ? Math.round(asset.duration / 1000) : Math.round(asset.duration);
    }
    setPickedDur(seconds);
    setPickedName(asset.fileName || asset.uri.split('/').pop() || 'trailer.mp4');

    setBusy(true);
    try {
      await studioEpisioApi.uploadTrailer(seriesId, {
        duration_seconds: seconds,
        width: asset.width || 1080,
        height: asset.height || 1920,
        source_filename: asset.fileName,
      });
      await load();
      Alert.alert(
        seconds >= 15 && seconds <= 60 ? 'Trailer registered' : 'Duration out of range',
        seconds >= 15 && seconds <= 60
          ? 'QA checklist updated. Trailer must stay 15–60 seconds.'
          : `Trailer is ${seconds}s — must be 15–60s. Re-export and try again.`,
      );
    } catch (e) {
      Alert.alert('Trailer failed', e?.data?.message || e?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  };

  const checks = [
    {
      ok: passed,
      pending: !passed && (!!series?.trailer_url || !!pickedName),
      label: passed ? '9:16 aspect ratio confirmed' : '9:16 aspect — pending server check',
    },
    {
      ok: passed,
      pending: !passed && (!!series?.trailer_url || !!pickedName),
      label: passed ? 'Resolution 1080 × 1920' : 'Resolution — pending server check',
    },
    { ok: inRange || passed, pending: false, label: 'Duration within 15–60s' },
    { ok: passed, pending: !passed && (!!series?.trailer_url || !!pickedName), label: 'No black frames detected' },
  ];

  return (
    <EpisioScreenShell
      title="Trailer"
      subtitle={series?.title || 'Series'}
      footer={(
        <EpisioGoldButton
          label="Save & Continue"
          onPress={() => navigation.goBack()}
        />
      )}
    >
      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <>
          <View style={styles.preview}>
            <Text style={styles.badge}>TRAILER</Text>
            <Text style={styles.previewTime}>
              {dur ? `${dur}s` : '—'}{inRange ? ' — in range' : dur ? ' — out of range' : ''}
            </Text>
            {pickedName ? <Text style={styles.fileName}>{pickedName}</Text> : null}
          </View>

          <View style={styles.meter}>
            <View style={styles.meterTrack}>
              <View style={[
                styles.meterFill,
                { width: `${Math.min(100, (dur / 60) * 100)}%` },
                !inRange && dur > 0 && { backgroundColor: '#E4573D' },
              ]}
              />
            </View>
            <View style={styles.meterLabels}>
              <Text style={styles.meterLbl}>15s</Text>
              <Text style={styles.meterLbl}>60s</Text>
            </View>
          </View>

          <EpisioGoldButton
            label="Replace Video"
            onPress={pickAndUpload}
            loading={busy}
            disabled={locked}
            variant="ghost"
            style={{ marginBottom: 16 }}
          />

          <View style={styles.qaCard}>
            <View style={styles.qaHead}>
              <Text style={styles.qaTitle}>Quality Check</Text>
              <View style={[styles.qaBadge, passed ? styles.pass : styles.fail]}>
                <Text style={styles.qaBadgeText}>{passed ? 'PASS' : (qa || 'PENDING').toUpperCase()}</Text>
              </View>
            </View>
            {checks.map((c) => (
              <View key={c.label} style={styles.checkRow}>
                <Check size={14} color={c.ok ? '#3DDC97' : (c.pending ? COLORS.gold : COLORS.textFaint)} />
                <Text style={[styles.checkText, !c.ok && { color: c.pending ? COLORS.gold : COLORS.textFaint }]}>{c.label}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.refresh} onPress={pickAndUpload} disabled={busy || locked}>
              <RefreshCw size={12} color={COLORS.gold} />
              <Text style={styles.refreshText}>Re-run Quality Check</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.fileCard}>
            <Text style={styles.fileTitle}>File Details</Text>
            <Text style={styles.fileLine}>Codec · H.264 / AAC (preferred)</Text>
            <Text style={styles.fileLine}>Target · 15–60 seconds · 9:16 or 16:9</Text>
            <Text style={styles.fileLine}>Status · {qa || 'not uploaded'}</Text>
          </View>
        </>
      )}
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  preview: {
    height: 220, borderRadius: 18, backgroundColor: COLORS.navyCard,
    borderWidth: 1, borderColor: COLORS.navyLine, justifyContent: 'flex-end', padding: 14, marginBottom: 14,
  },
  badge: {
    position: 'absolute', top: 12, left: 12, fontFamily: FONTS.extraBold, color: COLORS.gold, fontSize: 10,
  },
  previewTime: { fontFamily: FONTS.bold, color: '#fff', fontSize: 13 },
  fileName: { marginTop: 4, fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 11 },
  meter: { marginBottom: 14 },
  meterTrack: { height: 6, borderRadius: 4, backgroundColor: COLORS.navyCard, overflow: 'hidden' },
  meterFill: { height: '100%', backgroundColor: COLORS.gold },
  meterLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  meterLbl: { color: COLORS.textFaint, fontSize: 10, fontFamily: FONTS.regular },
  qaCard: {
    backgroundColor: COLORS.navyCard, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: COLORS.navyLine, marginBottom: 14,
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
    padding: 11, borderRadius: 12, backgroundColor: COLORS.navySoft,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  refreshText: { color: COLORS.gold, fontFamily: FONTS.bold, fontSize: 11.5 },
  fileCard: {
    backgroundColor: COLORS.navyCard, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  fileTitle: { fontFamily: FONTS.bold, color: '#fff', fontSize: 12.5, marginBottom: 8 },
  fileLine: { fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 11.5, marginBottom: 4 },
});

export default StudioTrailerScreen;
