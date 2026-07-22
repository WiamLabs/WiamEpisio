/**
 * Layout: WiamStudio-Series-Trailer.html
 * Real preview + sound · hard reject if duration/aspect won't fit every trailer place
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Alert, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Check, RefreshCw } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import StudioVideoPreview from '../../components/episio/StudioVideoPreview';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import { pickVideo } from '../../utils/pickMedia';
import resolveUrl from '../../utils/resolveUrl';

const MIN_TRAILER_SEC = 15;
const MAX_TRAILER_SEC = 60;

const probeSeconds = (asset) => {
  if (!asset?.duration) return 0;
  const raw = asset.duration > 1000 ? asset.duration / 1000 : Number(asset.duration);
  return Number.isFinite(raw) ? raw : 0;
};

const aspectOk = (w, h) => {
  if (!w || !h) return false;
  const ratio = w / h;
  const vertical = Math.abs(ratio - 9 / 16) <= 0.06;
  const landscape = Math.abs(ratio - 16 / 9) <= 0.06;
  if (vertical) return w >= 720 && h >= 1280;
  if (landscape) return w >= 1280 && h >= 720;
  return false;
};

const StudioTrailerScreen = () => {
  const navigation = useNavigation();
  const seriesId = useRoute().params?.seriesId;
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [localUri, setLocalUri] = useState(null);
  const [pickedDur, setPickedDur] = useState(null);
  const [pickedName, setPickedName] = useState(null);
  const [pickedSize, setPickedSize] = useState({ w: 0, h: 0 });
  const [rejectMsg, setRejectMsg] = useState(null);

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
  const failed = qa === 'failed';
  const durRaw = pickedDur != null ? pickedDur : (series?.trailer_duration_seconds || 0);
  const dur = Math.round(Number(durRaw) || 0);
  const inRange = Number(durRaw) >= MIN_TRAILER_SEC && Number(durRaw) <= MAX_TRAILER_SEC;
  const sizeOk = aspectOk(pickedSize.w, pickedSize.h)
    || (passed && !localUri);

  const remotePreview = useMemo(() => {
    const u = resolveUrl(series?.trailer_url);
    if (!u || u.includes('stub.local') || !u.startsWith('http')) return null;
    return u;
  }, [series?.trailer_url]);

  const previewUri = localUri || remotePreview;

  const pickAndUpload = async () => {
    if (locked) {
      Alert.alert('Season locked', 'Trailer replace opens when Needs Changes allows a fix window.');
      return;
    }
    const asset = await pickVideo();
    if (!asset) return;

    const seconds = probeSeconds(asset);
    const w = Number(asset.width) || 0;
    const h = Number(asset.height) || 0;
    setLocalUri(asset.uri);
    setPickedDur(seconds);
    setPickedName(asset.fileName || asset.uri.split('/').pop() || 'trailer.mp4');
    setPickedSize({ w, h });
    setRejectMsg(null);

    if (seconds < MIN_TRAILER_SEC || seconds > MAX_TRAILER_SEC) {
      const msg = (
        `Trailer must be ${MIN_TRAILER_SEC}–${MAX_TRAILER_SEC} seconds for every trailer place `
        + `(home, series page, soft interest). Yours is ${seconds.toFixed(1)}s — re-export and try again.`
      );
      setRejectMsg(msg);
      Alert.alert('Trailer rejected', msg);
      return;
    }
    if (!aspectOk(w, h)) {
      const msg = (
        `Trailer must be 9:16 vertical or 16:9 landscape so it fits every trailer place. `
        + (w && h ? `Got ${w}×${h}.` : 'Could not read size — export again.')
      );
      setRejectMsg(msg);
      Alert.alert('Trailer rejected', msg);
      return;
    }

    setBusy(true);
    try {
      const out = await studioEpisioApi.uploadTrailer(seriesId, {
        duration_seconds: seconds,
        width: w,
        height: h,
        source_filename: asset.fileName,
        local_uri: asset.uri,
      });
      await load();
      const status = out?.trailer_qa?.status || out?.series?.trailer_qa_status;
      if (status === 'failed' || out?.error === 'trailer_rejected') {
        const msg = out?.trailer_qa?.failure_reasons || out?.message || 'Trailer did not pass quality checks.';
        setRejectMsg(msg);
        Alert.alert('Trailer rejected', msg);
      } else {
        setRejectMsg(null);
        Alert.alert(
          'Trailer saved',
          `Preview below with real sound. Duration ${Math.round(seconds)}s · QA: ${(status || 'pending').toUpperCase()}.`,
        );
      }
    } catch (e) {
      const msg = e?.data?.message || e?.message || 'Try again';
      setRejectMsg(msg);
      Alert.alert('Trailer rejected', msg);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const checks = [
    {
      ok: sizeOk && (passed || (!!localUri && aspectOk(pickedSize.w, pickedSize.h))),
      pending: !passed && !failed && (!!series?.trailer_url || !!pickedName) && !rejectMsg,
      label: sizeOk
        ? (pickedSize.w && pickedSize.h
          ? `${pickedSize.w < pickedSize.h ? '9:16' : '16:9'} · ${pickedSize.w}×${pickedSize.h}`
          : 'Aspect fits trailer places')
        : '9:16 or 16:9 required for every trailer place',
    },
    {
      ok: inRange && !rejectMsg,
      pending: false,
      label: inRange
        ? `Duration ${dur}s within ${MIN_TRAILER_SEC}–${MAX_TRAILER_SEC}s`
        : `Duration must be ${MIN_TRAILER_SEC}–${MAX_TRAILER_SEC}s (yours: ${dur || '—'}s)`,
    },
    {
      ok: passed,
      pending: !passed && !failed && (!!series?.trailer_url || !!pickedName),
      label: passed ? 'Quality check passed' : (failed || rejectMsg ? 'Quality check failed' : 'Quality check pending'),
    },
    {
      ok: passed,
      pending: !passed && !failed && (!!series?.trailer_url || !!pickedName),
      label: 'No black frames / placement fit',
    },
  ];

  return (
    <EpisioScreenShell
      title="Trailer"
      subtitle={series?.title || 'Series'}
      footer={(
        <EpisioGoldButton
          label="Save & Continue"
          onPress={() => {
            if (rejectMsg || failed) {
              Alert.alert(
                'Trailer not accepted',
                rejectMsg || 'Fix duration/aspect so it fits every trailer place, then upload again.',
              );
              return;
            }
            navigation.goBack();
          }}
        />
      )}
    >
      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <>
          <StudioVideoPreview
            uri={previewUri}
            badge="TRAILER"
            aspectRatio={pickedSize.w && pickedSize.h && pickedSize.w > pickedSize.h ? 16 / 9 : 9 / 16}
            maxHeight={320}
            emptyLabel="Pick a trailer to preview with sound"
          />

          <Text style={styles.previewTime}>
            {dur ? `${dur}s` : '—'}
            {inRange && !rejectMsg ? ' — in range' : dur ? ' — out of range' : ''}
          </Text>
          {pickedName ? <Text style={styles.fileName}>{pickedName}</Text> : null}
          {rejectMsg ? <Text style={styles.rejectText}>{rejectMsg}</Text> : null}

          <View style={styles.meter}>
            <View style={styles.meterTrack}>
              <View style={[
                styles.meterFill,
                { width: `${Math.min(100, (Number(durRaw) / MAX_TRAILER_SEC) * 100)}%` },
                (!inRange || rejectMsg) && dur > 0 && { backgroundColor: '#E4573D' },
              ]}
              />
            </View>
            <View style={styles.meterLabels}>
              <Text style={styles.meterLbl}>{MIN_TRAILER_SEC}s min</Text>
              <Text style={styles.meterLbl}>{MAX_TRAILER_SEC}s max</Text>
            </View>
          </View>

          <EpisioGoldButton
            label={previewUri ? 'Replace Video' : 'Upload Trailer'}
            onPress={pickAndUpload}
            loading={busy}
            disabled={locked}
            variant="ghost"
            style={{ marginBottom: 16 }}
          />

          <View style={styles.qaCard}>
            <View style={styles.qaHead}>
              <Text style={styles.qaTitle}>Quality Check</Text>
              <View style={[
                styles.qaBadge,
                passed ? styles.pass : (failed || rejectMsg ? styles.fail : styles.pending),
              ]}
              >
                <Text style={styles.qaBadgeText}>
                  {passed ? 'PASS' : (failed || rejectMsg ? 'FAIL' : (qa || 'PENDING').toUpperCase())}
                </Text>
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
            <Text style={styles.fileLine}>
              Target · {MIN_TRAILER_SEC}–{MAX_TRAILER_SEC} seconds · 9:16 or 16:9 (must fit every trailer place)
            </Text>
            <Text style={styles.fileLine}>Status · {rejectMsg ? 'rejected' : (qa || 'not uploaded')}</Text>
            <Text style={styles.fileLine}>Sound · Preview plays with real audio — tap the speaker to mute</Text>
          </View>
        </>
      )}
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  previewTime: { fontFamily: FONTS.bold, color: '#fff', fontSize: 13, marginBottom: 4 },
  fileName: { marginBottom: 8, fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 11 },
  rejectText: {
    fontFamily: FONTS.medium, color: '#E4573D', fontSize: 12, lineHeight: 17, marginBottom: 10,
  },
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
  pending: { backgroundColor: 'rgba(212,160,23,0.15)' },
  qaBadgeText: { fontFamily: FONTS.extraBold, fontSize: 10, color: '#fff' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  checkText: { fontFamily: FONTS.regular, color: COLORS.text, fontSize: 12, flex: 1 },
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
