/**
 * WiamStudio-Specs-Guide.html — Video & Image Specs with mediaSpecs API merge.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import studioEpisioApi from '../../api/studioEpisio';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

const REJECT = [
  'Horizontal or square video — vertical only',
  'Watermarked exports used as the final file',
  'Black bars that break the 9:16 frame',
];

function pick(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return obj[k];
  }
  return null;
}

function fmtVal(v) {
  if (v == null) return null;
  if (Array.isArray(v)) return v.join(' – ');
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

const SpecTable = ({ title, rows }) => (
  <View style={styles.block}>
    <Text style={styles.blockTitle}>{title}</Text>
    {rows.map((r) => (
      <View key={r.label} style={styles.specRow}>
        <Text style={styles.specKey}>{r.label}</Text>
        <Text style={[styles.specVal, r.emphasis && styles.specEm]}>{r.value}</Text>
      </View>
    ))}
  </View>
);

const StudioSpecsScreen = () => {
  const navigation = useNavigation();
  const [api, setApi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    studioEpisioApi.mediaSpecs()
      .then((d) => { if (live) setApi(d); })
      .catch((e) => { if (live) setError(e?.message || 'Could not load live specs'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const episode = api?.specs?.episode || api?.specs?.episodes || api?.episode || {};
  const trailer = api?.specs?.trailer || api?.trailer || {};
  const cover = api?.specs?.cover || api?.specs?.poster || api?.cover || {};

  const episodeRows = useMemo(() => ([
    {
      label: 'Orientation',
      value: fmtVal(pick(episode, 'orientation', 'orient')) || 'Vertical only',
      emphasis: true,
    },
    {
      label: 'Aspect ratio',
      value: fmtVal(pick(episode, 'aspect_ratio', 'aspect', 'ratio')) || '9:16 exact',
      emphasis: true,
    },
    {
      label: 'Preferred res.',
      value: fmtVal(pick(episode, 'preferred_resolution', 'preferred_res', 'resolution')) || '1080 × 1920',
    },
    {
      label: 'Minimum res.',
      value: fmtVal(pick(episode, 'min_resolution', 'minimum_resolution', 'min_res')) || '720 × 1280',
    },
    {
      label: 'Codec',
      value: fmtVal(pick(episode, 'codec', 'codecs')) || 'H.264 + AAC (MP4)',
    },
    {
      label: 'Target length',
      value: fmtVal(pick(episode, 'target_duration', 'duration', 'length', 'target_length')) || '4–5 minutes',
      emphasis: true,
    },
    {
      label: 'Accept band',
      value: fmtVal(pick(episode, 'accept_band', 'duration_band', 'duration_range')) || '3:00 – 6:00',
    },
    {
      label: 'Max file size',
      value: fmtVal(pick(episode, 'max_file_size', 'max_size_mb', 'max_mb')) || '500 MB',
    },
  ]), [episode]);

  const trailerRows = useMemo(() => ([
    {
      label: 'Aspect',
      value: fmtVal(pick(trailer, 'aspect_ratio', 'aspect')) || '9:16',
      emphasis: true,
    },
    {
      label: 'Duration',
      value: fmtVal(pick(trailer, 'duration', 'duration_seconds', 'length')) || '15–60 seconds',
      emphasis: true,
    },
    {
      label: 'Purpose',
      value: fmtVal(pick(trailer, 'purpose')) || 'Hook only — quality gate',
    },
    {
      label: 'Codec',
      value: fmtVal(pick(trailer, 'codec')) || 'H.264 MP4',
    },
  ]), [trailer]);

  const coverRows = useMemo(() => ([
    {
      label: 'Role',
      value: fmtVal(pick(cover, 'role')) || 'Thumbnail on Home rails',
    },
    {
      label: 'Aspect',
      value: fmtVal(pick(cover, 'aspect_ratio', 'aspect')) || '2:3 portrait',
      emphasis: true,
    },
    {
      label: 'Min size',
      value: fmtVal(pick(cover, 'min_size', 'minimum', 'min_resolution')) || '600 × 900',
    },
    {
      label: 'Preferred',
      value: fmtVal(pick(cover, 'preferred', 'preferred_size', 'preferred_resolution')) || '1080 × 1620',
    },
    {
      label: 'Formats',
      value: fmtVal(pick(cover, 'formats', 'allowed_formats')) || 'JPG · PNG · WebP',
    },
    {
      label: 'Max size',
      value: fmtVal(pick(cover, 'max_file_size', 'max_size_mb', 'max_mb')) || '5 MB',
    },
  ]), [cover]);

  return (
    <EpisioScreenShell
      title="Video & Image Specs"
      subtitle="Match these exactly — every time"
      footer={(
        <EpisioGoldButton label="Got it — start uploading" onPress={() => navigation.goBack()} />
      )}
    >
      <View style={styles.intro}>
        <Text style={styles.introText}>
          We reject <Text style={styles.em}>soft, blurry, wrong-size, or incomplete</Text> series.
          Finish the show. Match the frame. Then we go live.
        </Text>
        <Text style={styles.sectionTitle}>Images</Text>
        <Text style={styles.note}>
          Covers, banners, and profile photos upload securely to WiamEpisio. Videos use our video pipeline — sizes below still apply.
        </Text>
        {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 8 }} /> : null}
        {error ? <Text style={styles.error}>{error} — showing defaults.</Text> : null}
      </View>

      <SpecTable title="Episode Video" rows={episodeRows} />
      <SpecTable title="Trailer Video" rows={trailerRows} />
      <SpecTable title="Cover / Poster" rows={coverRows} />

      <View style={styles.reject}>
        <Text style={styles.rejectTitle}>Automatic rejection</Text>
        {REJECT.map((line) => (
          <Text key={line} style={styles.rejectLine}>• {line}</Text>
        ))}
      </View>

      <Text style={styles.quote}>
        Finish the show. Match the frame. Then we go live.
      </Text>
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  intro: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.navyLine, padding: 16, marginTop: 4, marginBottom: 16,
  },
  introText: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textDim, lineHeight: 20 },
  em: { fontFamily: FONTS.semi, color: COLORS.gold },
  sectionTitle: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.gold, marginBottom: 6, marginTop: 8 },
  note: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textDim, lineHeight: 18, marginBottom: 14 },
  error: { fontFamily: FONTS.regular, fontSize: 11, color: COLORS.error, marginTop: 6 },
  block: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.navyLine, padding: 14, marginBottom: 14,
  },
  blockTitle: { fontFamily: FONTS.extraBold, fontSize: 14, color: COLORS.gold, marginBottom: 10 },
  specRow: {
    flexDirection: 'row', justifyContent: 'space-between', gap: 12,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.navyLine,
  },
  specKey: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textDim, flex: 1 },
  specVal: { fontFamily: FONTS.semi, fontSize: 12, color: COLORS.text, flex: 1.2, textAlign: 'right' },
  specEm: { color: COLORS.gold },
  reject: {
    backgroundColor: 'rgba(207,102,121,0.12)', borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: 'rgba(207,102,121,0.35)', padding: 14, marginTop: 4,
  },
  rejectTitle: { fontFamily: FONTS.extraBold, fontSize: 13, color: COLORS.error, marginBottom: 8 },
  rejectLine: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.text, lineHeight: 20, marginBottom: 2 },
  quote: {
    fontFamily: FONTS.displaySemi, fontSize: 14, color: COLORS.textDim,
    textAlign: 'center', marginTop: 20, fontStyle: 'italic', lineHeight: 22,
  },
});

export default StudioSpecsScreen;
