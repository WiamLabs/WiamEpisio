/**
 * Layout: WiamStudio-Series-Banner.html
 * Optional 16:9 banner · uploadBanner(seriesId, uri)
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { BarChart2, Monitor } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import resolveUrl from '../../utils/resolveUrl';
import { pickImageAsIs } from '../../utils/pickMedia';

const WHERE_USED = [
  { icon: BarChart2, text: 'Home page hero carousel, when your series is featured by the team' },
  { icon: Monitor, text: 'Top of your Series Detail page (wide screens)' },
];

const StudioBannerScreen = () => {
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
      const url = d?.series?.has_banner ? resolveUrl(d?.series?.banner_url) : null;
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

  const pickBanner = async () => {
    const uri = await pickImageAsIs();
    if (!uri) return;
    setBusy(true);
    try {
      await studioEpisioApi.uploadBanner(seriesId, uri);
      setPreviewUri(uri);
      setPass(true);
      Alert.alert('Banner uploaded', 'Our team may feature strong banners on Home.');
      await load();
    } catch (e) {
      Alert.alert('Upload failed', e?.message || 'Try a wide JPG under 5 MB.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <EpisioScreenShell
      title="Featured Banner"
      subtitle={series?.title || 'Your series'}
      footer={(
        <>
          <EpisioGoldButton label="Upload Banner" onPress={pickBanner} loading={busy} />
          <View style={{ height: 10 }} />
          <EpisioGoldButton label="Save & Continue" onPress={() => navigation.goBack()} variant="ghost" />
        </>
      )}
    >
      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} />
      ) : (
        <>
          <Text style={styles.optionalTag}>OPTIONAL · 16:9</Text>
          <Text style={styles.uploadHint}>Upload your full wide flyer — no crop. We validate size and ratio on upload.</Text>

          <View style={styles.bannerPreview}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            ) : null}
            <View style={styles.bannerOverlay}>
              <Text style={styles.bannerTitle}>{series?.title || 'Your series'}</Text>
              <Text style={styles.bannerSub}>
                {series?.genre || 'Drama'}
                {series?.subgenre ? ` · ${series.subgenre}` : ''}
              </Text>
            </View>
          </View>
          <Text style={styles.dimNote}>
            1920 × 1080 · <Text style={{ color: '#3BB273' }}>{pass ? 'Pass' : 'Not uploaded'}</Text>
          </Text>

          <View style={styles.whereUsed}>
            <Text style={styles.whereTitle}>Where this appears</Text>
            {WHERE_USED.map(({ icon: Icon, text }) => (
              <View key={text} style={styles.whereRow}>
                <Icon size={15} color={COLORS.gold} />
                <Text style={styles.whereText}>{text}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </>
      )}
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  optionalTag: {
    alignSelf: 'flex-start', fontSize: 9.5, fontFamily: FONTS.extraBold, color: COLORS.gold,
    backgroundColor: 'rgba(212,160,23,0.14)', paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 6, marginBottom: 8, overflow: 'hidden',
  },
  uploadHint: {
    fontSize: 11.5, fontFamily: FONTS.regular, color: COLORS.textDim, lineHeight: 17, marginBottom: 14,
  },
  bannerPreview: {
    width: '100%', aspectRatio: 16 / 9, borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#241a3a', borderWidth: 1, borderColor: COLORS.navyLine, marginBottom: 8,
  },
  bannerOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  bannerTitle: { fontSize: 15, fontFamily: FONTS.extraBold, color: '#fff' },
  bannerSub: { fontSize: 10, fontFamily: FONTS.regular, color: '#D9D9E8', marginTop: 2 },
  dimNote: { textAlign: 'center', fontSize: 10.5, color: COLORS.textFaint, marginVertical: 8 },
  whereUsed: {
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 16, padding: 15, marginBottom: 14,
  },
  whereTitle: { fontSize: 12.5, fontFamily: FONTS.bold, color: '#fff', marginBottom: 10 },
  whereRow: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  whereText: { flex: 1, fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textDim, lineHeight: 17 },
  skipText: {
    textAlign: 'center', fontSize: 12.5, fontFamily: FONTS.bold, color: '#C9C9DE', paddingVertical: 8,
  },
});

export default StudioBannerScreen;
