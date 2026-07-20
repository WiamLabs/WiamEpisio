/**
 * Layout: WiamStudio-Series-Cover.html
 * Pick 2:3 cover · uploadCover(seriesId, uri)
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Check } from 'lucide-react-native';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import resolveUrl from '../../utils/resolveUrl';
import { pickImageAsIs } from '../../utils/pickMedia';

const CHECKS = [
  '2:3 portrait ratio (upload your full flyer)',
  'Resolution above 600×900',
  'No embedded text or logos',
  'File under 5 MB — system validates size/ratio',
];

const TIPS = [
  'Show your main character\'s face clearly',
  'High contrast beats busy backgrounds',
  'Avoid text — the title renders automatically',
];

const StudioCoverScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const seriesId = useRoute().params?.seriesId;
  const [series, setSeries] = useState(null);
  const [previewUri, setPreviewUri] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pass, setPass] = useState(false);

  const load = useCallback(async () => {
    if (!seriesId) return;
    setLoading(true);
    try {
      const d = await studioEpisioApi.getSeries(seriesId);
      setSeries(d?.series);
      const url = d?.series?.has_cover
        ? resolveUrl(d?.series?.cover_url || d?.series?.poster_url)
        : null;
      if (url) {
        setPreviewUri(url);
        setPass(true);
      } else {
        setPreviewUri(null);
        setPass(false);
      }
    } finally {
      setLoading(false);
    }
  }, [seriesId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pickCover = async () => {
    const uri = await pickImageAsIs();
    if (!uri) return;
    setBusy(true);
    try {
      await studioEpisioApi.uploadCover(seriesId, uri);
      setPreviewUri(uri);
      setPass(true);
      Alert.alert('Cover uploaded', 'The WiamEpisio team will check it during review.');
      await load();
    } catch (e) {
      Alert.alert('Upload failed', e?.message || 'Try a JPG under 5 MB.');
    } finally {
      setBusy(false);
    }
  };

  const next = () => navigation.navigate('StudioEpisodeList', { seriesId });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <ChevronLeft size={15} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.stepLabel}>Step 2 of 4</Text>
        </View>
        <View style={styles.stepTrack}>
          <View style={[styles.stepSeg, styles.stepDone]} />
          <View style={[styles.stepSeg, styles.stepDone]} />
          <View style={styles.stepSeg} />
          <View style={styles.stepSeg} />
        </View>
        <Text style={styles.title}>Add your cover</Text>
        <Text style={styles.sub}>Upload your full 2:3 flyer — no crop. We validate size and ratio on upload.</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.left}>
            <View style={styles.coverPreview}>
              {previewUri ? (
                <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              ) : null}
              <View style={styles.coverOverlay}>
                <Text style={styles.coverTitle}>{series?.title || 'Your series'}</Text>
              </View>
            </View>
            <Text style={styles.dimBadge}>
              1080 × 1620 · <Text style={{ color: '#3BB273' }}>{pass ? 'Pass' : 'Pending'}</Text>
            </Text>
            <TouchableOpacity style={styles.replaceBtn} onPress={pickCover} disabled={busy}>
              {busy ? <ActivityIndicator color={COLORS.text} size="small" /> : (
                <Text style={styles.replaceText}>Replace Cover</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.right}>
            <View style={styles.checkCard}>
              <Text style={styles.checkTitle}>Cover Checklist</Text>
              {CHECKS.map((c) => (
                <View key={c} style={styles.checkItem}>
                  <Check size={14} color="#3BB273" />
                  <Text style={styles.checkText}>{c}</Text>
                </View>
              ))}
            </View>
            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>Tips for a cover that gets clicks</Text>
              {TIPS.map((t) => (
                <Text key={t} style={styles.tipLine}>• {t}</Text>
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <EpisioGoldButton label="Next: Genres & Episodes" onPress={next} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  topbar: { paddingHorizontal: 20, paddingBottom: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  stepLabel: { fontSize: 11, fontFamily: FONTS.bold, color: COLORS.textFaint },
  stepTrack: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  stepSeg: { flex: 1, height: 4, borderRadius: 99, backgroundColor: COLORS.navyLine },
  stepDone: { backgroundColor: COLORS.gold },
  title: { fontSize: 20, fontFamily: FONTS.extraBold, color: '#fff', marginBottom: 5 },
  sub: { fontSize: 12.5, fontFamily: FONTS.regular, color: COLORS.textDim },
  scroll: { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 20, gap: 18 },
  left: { width: 140 },
  right: { flex: 1, minWidth: 0 },
  coverPreview: {
    width: 140, height: 210, borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#3a1420', borderWidth: 1, borderColor: COLORS.navyLine, marginBottom: 12,
  },
  coverOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  coverTitle: { fontSize: 12, fontFamily: FONTS.extraBold, color: '#fff' },
  dimBadge: { textAlign: 'center', fontSize: 10, color: COLORS.textFaint, marginBottom: 10 },
  replaceBtn: {
    padding: 10, borderRadius: 11, backgroundColor: COLORS.navyCard,
    borderWidth: 1, borderColor: COLORS.navyLine, alignItems: 'center',
  },
  replaceText: { fontSize: 11, fontFamily: FONTS.bold, color: '#C9C9DE' },
  checkCard: {
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 16, padding: 15, marginBottom: 14,
  },
  checkTitle: { fontSize: 12.5, fontFamily: FONTS.bold, color: '#fff', marginBottom: 10 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  checkText: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textDim, flex: 1 },
  tipsCard: {
    backgroundColor: 'rgba(212,160,23,0.08)', borderWidth: 1, borderColor: 'rgba(212,160,23,0.25)',
    borderRadius: 16, padding: 15,
  },
  tipsTitle: { fontSize: 11.5, fontFamily: FONTS.extraBold, color: COLORS.gold, marginBottom: 8 },
  tipLine: { fontSize: 10.5, fontFamily: FONTS.regular, color: '#D9C89A', lineHeight: 17, marginBottom: 5 },
  footer: { paddingHorizontal: 20, paddingTop: 12 },
  cta: {
    padding: 16, borderRadius: 16, backgroundColor: COLORS.gold, alignItems: 'center',
  },
  ctaText: { fontSize: 15, fontFamily: FONTS.extraBold, color: COLORS.navy },
});

export default StudioCoverScreen;
