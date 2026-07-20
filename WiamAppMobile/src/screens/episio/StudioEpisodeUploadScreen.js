/**
 * Layout: WiamStudio-Episode-Upload.html
 * Validates 9:16 + duration via complete-upload; mark-final after ready.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Alert, TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Upload, Film } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';

const StudioEpisodeUploadScreen = () => {
  const navigation = useNavigation();
  const params = useRoute().params || {};
  const { seriesId, episodeId: existingId, episodeNumber, locked } = params;
  const [title, setTitle] = useState(episodeNumber ? `Episode ${episodeNumber}` : '');
  const [pickedName, setPickedName] = useState(null);
  const [width, setWidth] = useState('1080');
  const [height, setHeight] = useState('1920');
  const [duration, setDuration] = useState('270');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const pickVideo = async () => {
    if (locked) {
      Alert.alert('Season locked', 'Replace files only when Needs Changes opens a fix window.');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow media access to pick an episode video.');
      return;
    }
    const pick = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
    });
    if (pick.canceled || !pick.assets?.[0]) return;
    const asset = pick.assets[0];
    setPickedName(asset.fileName || asset.uri.split('/').pop() || 'episode.mp4');
    if (asset.width) setWidth(String(asset.width));
    if (asset.height) setHeight(String(asset.height));
    if (asset.duration) {
      // expo may report ms
      const sec = asset.duration > 1000 ? Math.round(asset.duration / 1000) : Math.round(asset.duration);
      if (sec > 0) setDuration(String(sec));
    }
  };

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
        source_filename: pickedName || undefined,
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
    <EpisioScreenShell
      title="Episodes"
      subtitle={episodeNumber ? `Episode ${episodeNumber}` : 'Add episode'}
      footer={(
        <>
          <EpisioGoldButton
            label="Validate draft upload"
            onPress={() => upload({ markFinal: false })}
            loading={busy}
            disabled={locked}
          />
          <View style={{ height: 10 }} />
          <EpisioGoldButton
            label="Validate & mark final"
            onPress={() => upload({ markFinal: true })}
            disabled={busy || locked}
            variant="ghost"
          />
        </>
      )}
    >
      <View style={styles.specCallout}>
        <Text style={styles.specTitle}>9:16 · 1080×1920 · 4–5 min · MP4</Text>
        <Text style={styles.specSub}>
          Anything outside 3:00–6:00 or the wrong aspect gets auto-rejected.
        </Text>
      </View>

      <TouchableOpacity style={styles.dropZone} onPress={pickVideo} disabled={locked} activeOpacity={0.85}>
        <View style={styles.dropIcon}>
          {pickedName ? <Film size={22} color={COLORS.gold} /> : <Upload size={22} color={COLORS.gold} />}
        </View>
        <Text style={styles.dropTitle}>
          {pickedName ? 'Video selected' : 'Choose episode video'}
        </Text>
        <Text style={styles.dropSub}>
          {pickedName || 'Upload from your device — vertical 9:16 only'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.label}>Episode title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholderTextColor={COLORS.textFaint}
        placeholder="Episode title"
      />

      <Text style={styles.label}>Probe (width × height × duration)</Text>
      <Text style={styles.hint}>
        Filled from your file when available. Adjust only if the probe is wrong.
      </Text>
      <View style={styles.row}>
        <TextInput style={[styles.input, { flex: 1 }]} value={width} onChangeText={setWidth} keyboardType="number-pad" placeholder="W" placeholderTextColor={COLORS.textFaint} />
        <TextInput style={[styles.input, { flex: 1 }]} value={height} onChangeText={setHeight} keyboardType="number-pad" placeholder="H" placeholderTextColor={COLORS.textFaint} />
        <TextInput style={[styles.input, { flex: 1 }]} value={duration} onChangeText={setDuration} keyboardType="number-pad" placeholder="sec" placeholderTextColor={COLORS.textFaint} />
      </View>

      {result ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultText}>
            EP {result.episode_number} · {(result.transcode_status || 'ready').toUpperCase()}
            {result.is_final ? ' · FINAL' : ' · draft ready'}
          </Text>
        </View>
      ) : null}
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  specCallout: {
    backgroundColor: 'rgba(212,160,23,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.3)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  specTitle: { fontFamily: FONTS.extraBold, color: COLORS.gold, fontSize: 12.5, marginBottom: 4 },
  specSub: { fontFamily: FONTS.regular, color: '#D9C89A', fontSize: 11.5, lineHeight: 17 },
  dropZone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.navyLine,
    borderRadius: 18,
    backgroundColor: COLORS.navyCard,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 18,
  },
  dropIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(212,160,23,0.14)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  dropTitle: { fontFamily: FONTS.bold, color: '#fff', fontSize: 14, marginBottom: 4 },
  dropSub: { fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 12, textAlign: 'center' },
  label: { color: COLORS.textDim, fontFamily: FONTS.semi, fontSize: 11.5, marginBottom: 6 },
  hint: { color: COLORS.textFaint, fontFamily: FONTS.regular, fontSize: 11, marginBottom: 8, marginTop: -2 },
  input: {
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 12, padding: 13, color: COLORS.text, marginBottom: 12, fontFamily: FONTS.regular,
  },
  row: { flexDirection: 'row', gap: 10 },
  resultCard: {
    marginTop: 4, padding: 12, borderRadius: 12,
    backgroundColor: 'rgba(59,178,115,0.12)', borderWidth: 1, borderColor: 'rgba(59,178,115,0.3)',
  },
  resultText: { color: '#3BB273', fontFamily: FONTS.medium, fontSize: 12.5 },
});

export default StudioEpisodeUploadScreen;
