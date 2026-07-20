/**
 * Layout: WiamStudio-Episode-Upload.html
 * Validates 9:16 + duration via complete-upload; mark-final after ready.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';

const StudioEpisodeUploadScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const params = useRoute().params || {};
  const { seriesId, episodeId: existingId, episodeNumber, locked } = params;
  const [title, setTitle] = useState(episodeNumber ? `Episode ${episodeNumber}` : '');
  const [width, setWidth] = useState('1080');
  const [height, setHeight] = useState('1920');
  const [duration, setDuration] = useState('270');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const upload = async ({ markFinal }) => {
    if (locked) {
      Alert.alert('Season locked', 'Replace files only when Needs Changes opens a fix window.');
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      let epId = existingId;
      if (!epId) {
        const created = await studioEpisioApi.createEpisode(seriesId, {
          episode_number: episodeNumber || undefined,
          title: title.trim() || undefined,
        });
        epId = created?.episode?.id;
        if (!epId) throw new Error('No episode id');
      }
      const done = await studioEpisioApi.completeUpload(epId, {
        width: Number(width),
        height: Number(height),
        duration_seconds: Number(duration),
        is_final: !!markFinal,
        storage_key: `stub/ep_${epId}`,
        hls_manifest_url: `https://stub.local/hls/ep_${epId}/master.m3u8`,
      });
      if (markFinal && done?.episode && !done.episode.is_final) {
        await studioEpisioApi.markFinal(epId, true);
      }
      setResult(done?.episode);
      Alert.alert(
        markFinal ? 'Marked final' : 'Upload ready',
        markFinal
          ? `EP ${done?.episode?.episode_number} is final for this season.`
          : 'File validated (9:16 + duration). Mark final when the cut is locked.',
      );
      if (markFinal) navigation.goBack();
    } catch (e) {
      if (e?.data?.error === 'wrong_size' || e?.data?.error === 'bad_duration') {
        navigation.replace('StudioEpisodeReject', {
          seriesId,
          episodeNumber: episodeNumber || result?.episode_number,
          message: e?.data?.message || e.message,
        });
        return;
      }
      Alert.alert('Upload failed', e?.data?.message || e?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={[styles.root, { paddingTop: insets.top + 8 }]} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <ChevronLeft size={20} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={styles.title}>Episode upload</Text>
      <Text style={styles.hint}>
        Specs: 9:16 · preferred 1080×1920 · episode must be 4–5 minutes only (not shorter/longer). Draft upload first; mark final when the cut is locked.
      </Text>

      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholderTextColor={COLORS.textFaint} placeholder="Episode title" />
      <Text style={styles.label}>Width × Height (probe)</Text>
      <View style={styles.row}>
        <TextInput style={[styles.input, { flex: 1 }]} value={width} onChangeText={setWidth} keyboardType="number-pad" />
        <TextInput style={[styles.input, { flex: 1 }]} value={height} onChangeText={setHeight} keyboardType="number-pad" />
      </View>
      <Text style={styles.label}>Duration (seconds)</Text>
      <TextInput style={styles.input} value={duration} onChangeText={setDuration} keyboardType="number-pad" />

      <TouchableOpacity style={styles.cta} onPress={() => upload({ markFinal: false })} disabled={busy || locked}>
        {busy ? <ActivityIndicator color={COLORS.navy} /> : <Text style={styles.ctaText}>Validate draft upload</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.ctaAlt} onPress={() => upload({ markFinal: true })} disabled={busy || locked}>
        <Text style={styles.ctaAltText}>Validate & mark final</Text>
      </TouchableOpacity>

      {result ? (
        <Text style={styles.ok}>
          EP {result.episode_number} · {result.transcode_status}
          {result.is_final ? ' · FINAL' : ' · draft ready'}
        </Text>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  title: { fontSize: 22, fontFamily: FONTS.extraBold, color: COLORS.text },
  hint: { marginTop: 8, marginBottom: 16, color: COLORS.textDim, fontFamily: FONTS.regular, lineHeight: 19 },
  label: { color: COLORS.textDim, fontFamily: FONTS.semi, fontSize: 11.5, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 12, padding: 13, color: COLORS.text, marginBottom: 12, fontFamily: FONTS.regular,
  },
  row: { flexDirection: 'row', gap: 10 },
  cta: { backgroundColor: COLORS.gold, borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 8 },
  ctaText: { fontFamily: FONTS.bold, color: COLORS.navy },
  ctaAlt: {
    marginTop: 10, borderRadius: 14, padding: 15, alignItems: 'center',
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  ctaAltText: { fontFamily: FONTS.bold, color: COLORS.gold },
  ok: { marginTop: 14, color: COLORS.success, fontFamily: FONTS.medium },
});

export default StudioEpisodeUploadScreen;
