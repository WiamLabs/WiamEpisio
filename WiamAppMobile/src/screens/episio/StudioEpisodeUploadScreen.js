/**
 * Layout: WiamStudio-Episode-Upload.html
 * Vertical 9:16 preview + required episode cover + keyboard-safe Validate CTAs.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Alert, TouchableOpacity, Image,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Upload, Film, ImagePlus } from 'lucide-react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import { pickVideo, pickImageAsIs } from '../../utils/pickMedia';
import resolveUrl from '../../utils/resolveUrl';

const StudioEpisodeUploadScreen = () => {
  const navigation = useNavigation();
  const params = useRoute().params || {};
  const { seriesId, episodeId: existingId, episodeNumber, locked } = params;
  const [title, setTitle] = useState(episodeNumber ? `Episode ${episodeNumber}` : '');
  const [pickedName, setPickedName] = useState(null);
  const [videoUri, setVideoUri] = useState(null);
  const [coverUri, setCoverUri] = useState(null);
  const [coverRemote, setCoverRemote] = useState(null);
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [duration, setDuration] = useState('');
  const [overrideProbe, setOverrideProbe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [episodeId, setEpisodeId] = useState(existingId || null);

  const player = useVideoPlayer(videoUri || '', (p) => {
    p.loop = true;
    p.muted = true;
    if (videoUri) {
      try { p.play(); } catch { /* ignore */ }
    }
  });

  useEffect(() => {
    if (!videoUri) return undefined;
    try {
      player.replace(videoUri);
      player.play();
    } catch { /* ignore */ }
    return undefined;
  }, [videoUri, player]);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      if (!seriesId || (!existingId && !episodeNumber)) return;
      try {
        const data = await studioEpisioApi.getSeries(seriesId);
        const eps = data?.episodes || [];
        const ep = eps.find((e) => (existingId && e.id === existingId)
          || (episodeNumber && e.episode_number === episodeNumber));
        if (!alive || !ep) return;
        setEpisodeId(ep.id);
        if (ep.title) setTitle(ep.title);
        const poster = resolveUrl(ep.poster_url || ep.thumbnail_url);
        if (poster) setCoverRemote(poster);
        if (ep.transcode_status === 'ready') {
          setResult(ep);
          setPickedName(ep.source_filename || `Episode ${ep.episode_number} (uploaded)`);
          if (ep.duration_seconds) setDuration(String(ep.duration_seconds));
        }
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [seriesId, existingId, episodeNumber]));

  const onPickVideo = async () => {
    if (locked) {
      Alert.alert('Season locked', 'Replace files only when Needs Changes opens a fix window.');
      return;
    }
    const asset = await pickVideo();
    if (!asset) return;
    setVideoUri(asset.uri);
    setPickedName(asset.fileName || asset.uri.split('/').pop() || 'episode.mp4');
    if (asset.width) setWidth(String(asset.width));
    if (asset.height) setHeight(String(asset.height));
    if (asset.duration) {
      const sec = asset.duration > 1000 ? Math.round(asset.duration / 1000) : Math.round(asset.duration);
      if (sec > 0) setDuration(String(sec));
    }
  };

  const onPickCover = async () => {
    if (locked) {
      Alert.alert('Season locked', 'Replace covers only when Needs Changes opens a fix window.');
      return;
    }
    const uri = await pickImageAsIs();
    if (!uri) return;
    setCoverUri(uri);
    setCoverRemote(null);
  };

  const ensureEpisodeCover = async (epId) => {
    if (coverUri) {
      const up = await studioEpisioApi.uploadEpisodeCover(epId, coverUri);
      const poster = resolveUrl(up?.poster_url || up?.episode?.poster_url);
      if (poster) setCoverRemote(poster);
      setCoverUri(null);
      return true;
    }
    if (coverRemote) return true;
    return false;
  };

  const upload = async ({ markFinal }) => {
    if (locked) {
      Alert.alert('Season locked', 'Replace files only when Needs Changes opens a fix window.');
      return;
    }
    if (!videoUri && !pickedName && !episodeId) {
      Alert.alert('Video required', 'Choose an episode video first.');
      return;
    }
    if (markFinal && !coverUri && !coverRemote) {
      Alert.alert(
        'Cover required',
        'Every episode needs its own cover image. Add a cover next to the title before marking final.',
      );
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      let epId = episodeId || existingId;
      if (!epId) {
        const created = await studioEpisioApi.createEpisode(seriesId, {
          episode_number: episodeNumber || undefined,
          title: title.trim() || undefined,
        });
        epId = created?.episode?.id;
        if (!epId) throw new Error('No episode id');
        setEpisodeId(epId);
      } else if (title.trim()) {
        try {
          await studioEpisioApi.patchEpisode(epId, { title: title.trim() });
        } catch { /* non-blocking */ }
      }

      const hasCover = await ensureEpisodeCover(epId);
      if (markFinal && !hasCover) {
        Alert.alert('Cover required', 'Upload an episode cover before marking final.');
        return;
      }

      const w = Number(width) || 1080;
      const h = Number(height) || 1920;
      const dur = Number(duration) || 270;
      let done = { episode: result };
      if (videoUri) {
        done = await studioEpisioApi.completeUpload(epId, {
          width: w,
          height: h,
          duration_seconds: dur,
          is_final: !!markFinal,
          storage_key: `stub/ep_${epId}`,
          hls_manifest_url: `https://stub.local/hls/ep_${epId}/master.m3u8`,
          source_filename: pickedName || undefined,
          local_uri: videoUri || undefined,
        });
      } else if (markFinal) {
        done = await studioEpisioApi.markFinal(epId, true);
      }

      if (markFinal && done?.episode && !done.episode.is_final) {
        done = await studioEpisioApi.markFinal(epId, true);
      }
      setResult(done?.episode || done);
      Alert.alert(
        markFinal ? 'Marked final' : 'Upload ready',
        markFinal
          ? `EP ${done?.episode?.episode_number || episodeNumber} is final — cover + video saved.`
          : 'File validated (9:16 + duration). Add cover + mark final when the cut is locked.',
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
      if (e?.data?.error === 'cover_required') {
        Alert.alert('Cover required', e?.data?.message || 'Add an episode cover first.');
        return;
      }
      Alert.alert('Upload failed', e?.data?.message || e?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  };

  const coverPreview = coverUri || coverRemote;

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
          Vertical 9:16 only (phone / Shorts-style). Landscape 16:9 will be rejected.
        </Text>
      </View>

      <TouchableOpacity style={styles.dropZone} onPress={onPickVideo} disabled={locked} activeOpacity={0.85}>
        {videoUri ? (
          <View style={styles.previewWrap}>
            <VideoView
              style={styles.preview}
              player={player}
              contentFit="contain"
              nativeControls={false}
            />
            <View style={styles.previewBadge}>
              <Film size={12} color={COLORS.navy} />
              <Text style={styles.previewBadgeText}>Preview</Text>
            </View>
          </View>
        ) : (
          <View style={styles.dropIcon}>
            <Upload size={22} color={COLORS.gold} />
          </View>
        )}
        <Text style={styles.dropTitle}>
          {pickedName ? 'Video selected — tap to change' : 'Choose episode video'}
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

      <Text style={styles.label}>Episode cover (required)</Text>
      <Text style={styles.hint}>
        Portrait image shown in the episode list and lock rails. Every episode needs its own cover.
      </Text>
      <TouchableOpacity style={styles.coverPick} onPress={onPickCover} disabled={locked} activeOpacity={0.85}>
        {coverPreview ? (
          <Image source={{ uri: coverPreview }} style={styles.coverImg} />
        ) : (
          <View style={styles.coverEmpty}>
            <ImagePlus size={20} color={COLORS.gold} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.coverTitle}>
            {coverPreview ? 'Cover selected — tap to change' : 'Add cover image'}
          </Text>
          <Text style={styles.coverSub}>Required before mark final · shows on EP list</Text>
        </View>
      </TouchableOpacity>

      {(videoUri || pickedName) ? (
        <View style={styles.probeBlock}>
          <Text style={styles.label}>Detected from your file</Text>
          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>
                {width && height ? `${width} × ${height}` : 'Size pending'}
              </Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipText}>
                {duration
                  ? `${Math.floor(Number(duration) / 60)}:${String(Number(duration) % 60).padStart(2, '0')}`
                  : 'Duration pending'}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setOverrideProbe((v) => !v)} style={styles.overrideLink}>
            <Text style={styles.overrideText}>
              {overrideProbe ? 'Hide override' : 'Override probe'}
            </Text>
          </TouchableOpacity>
          {overrideProbe ? (
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1 }]} value={width} onChangeText={setWidth} keyboardType="number-pad" placeholder="W" placeholderTextColor={COLORS.textFaint} />
              <TextInput style={[styles.input, { flex: 1 }]} value={height} onChangeText={setHeight} keyboardType="number-pad" placeholder="H" placeholderTextColor={COLORS.textFaint} />
              <TextInput style={[styles.input, { flex: 1 }]} value={duration} onChangeText={setDuration} keyboardType="number-pad" placeholder="sec" placeholderTextColor={COLORS.textFaint} />
            </View>
          ) : null}
        </View>
      ) : null}

      {result ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultText}>
            EP {result.episode_number} · {(result.transcode_status || 'ready').toUpperCase()}
            {result.is_final ? ' · FINAL' : ' · draft ready'}
            {result.has_cover || coverPreview ? ' · COVER' : ''}
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
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 18,
    overflow: 'hidden',
  },
  previewWrap: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 280,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 12,
  },
  preview: { width: '100%', height: '100%' },
  previewBadge: {
    position: 'absolute', top: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.gold, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  previewBadgeText: { fontFamily: FONTS.bold, fontSize: 10, color: COLORS.navy },
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
  coverPick: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 14, padding: 12, marginBottom: 16,
  },
  coverImg: { width: 52, height: 74, borderRadius: 8, backgroundColor: '#000' },
  coverEmpty: {
    width: 52, height: 74, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed',
    borderColor: COLORS.navyLine, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.navySoft,
  },
  coverTitle: { fontFamily: FONTS.bold, color: '#fff', fontSize: 13, marginBottom: 3 },
  coverSub: { fontFamily: FONTS.regular, color: COLORS.textFaint, fontSize: 11 },
  probeBlock: { marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  chipText: { fontFamily: FONTS.bold, color: '#fff', fontSize: 12 },
  overrideLink: { marginBottom: 10 },
  overrideText: { fontFamily: FONTS.semi, color: COLORS.gold, fontSize: 12 },
  row: { flexDirection: 'row', gap: 10 },
  resultCard: {
    marginTop: 4, padding: 12, borderRadius: 12,
    backgroundColor: 'rgba(59,178,115,0.12)', borderWidth: 1, borderColor: 'rgba(59,178,115,0.3)',
  },
  resultText: { color: '#3BB273', fontFamily: FONTS.medium, fontSize: 12.5 },
});

export default StudioEpisodeUploadScreen;
