/**
 * Layout: WiamStudio-Episode-Detail.html
 * Load series · edit title/synopsis · replace video · save / mark final
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, ActivityIndicator, Alert, Switch, Image,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Check, Play, Trash2 } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';
import EpisioScreenShell from '../../components/episio/EpisioScreenShell';
import EpisioGoldButton from '../../components/episio/EpisioGoldButton';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import resolveUrl from '../../utils/resolveUrl';
import { pickImageAsIs } from '../../utils/pickMedia';

const fmtDuration = (sec) => {
  const s = Number(sec) || 0;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
};

const probeMeta = (ep) => {
  try {
    return typeof ep?.upload_probe_json === 'string'
      ? JSON.parse(ep.upload_probe_json)
      : (ep?.upload_probe_json || {});
  } catch {
    return {};
  }
};

const StudioEpisodeDetailScreen = () => {
  const navigation = useNavigation();
  const { seriesId, episodeId, episodeNumber } = useRoute().params || {};
  const [episode, setEpisode] = useState(null);
  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [series, setSeries] = useState(null);

  const load = useCallback(async () => {
    if (!seriesId) return;
    setLoading(true);
    try {
      const data = await studioEpisioApi.getSeries(seriesId);
      setSeries(data?.series);
      const eps = data?.episodes || [];
      let ep = eps.find((e) => episodeId && e.id === episodeId);
      if (!ep && episodeNumber) ep = eps.find((e) => e.episode_number === episodeNumber);
      if (ep) {
        setEpisode(ep);
        setTitle(ep.title || `Episode ${ep.episode_number}`);
        setSynopsis(ep.synopsis || '');
      }
    } finally {
      setLoading(false);
    }
  }, [seriesId, episodeId, episodeNumber]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const locked = !!series?.season_locked && !series?.fix_window_open;
  const probe = probeMeta(episode);
  const ready = episode?.transcode_status === 'ready';
  const epNum = episode?.episode_number || episodeNumber;
  const freePreview = (epNum || 0) <= 5;
  const thumb = resolveUrl(episode?.poster_url || episode?.thumbnail_url);

  const save = async () => {
    if (!episode?.id) {
      Alert.alert('Saved', 'Changes kept locally. Upload the video to create this episode.');
      return;
    }
    setSaving(true);
    try {
      await studioEpisioApi.patchEpisode(episode.id, {
        title: title.trim(),
        synopsis: synopsis.trim(),
      });
      Alert.alert('Saved', 'The WiamEpisio team will see your updated episode details on review.');
      await load();
    } catch (e) {
      Alert.alert('Could not save', e?.message || 'Try again');
    } finally {
      setSaving(false);
    }
  };

  const replaceVideo = () => {
    navigation.navigate('StudioEpisodeUpload', {
      seriesId,
      episodeId: episode?.id,
      episodeNumber: epNum,
      locked,
    });
  };

  const changeCover = async () => {
    if (!episode?.id) {
      Alert.alert('Upload first', 'Create the episode (upload video) before adding a cover.');
      return;
    }
    if (locked) {
      Alert.alert('Season locked', 'Replace covers only when Needs Changes opens a fix window.');
      return;
    }
    const uri = await pickImageAsIs();
    if (!uri) return;
    try {
      await studioEpisioApi.uploadEpisodeCover(episode.id, uri);
      await load();
    } catch (e) {
      Alert.alert('Cover failed', e?.data?.message || e?.message || 'Try again');
    }
  };

  const toggleFinal = async (val) => {
    if (!episode?.id || !ready) return;
    if (val && !(episode.poster_url || episode.has_cover || thumb)) {
      Alert.alert('Cover required', 'Add an episode cover before marking final.');
      return;
    }
    try {
      await studioEpisioApi.markFinal(episode.id, val);
      await load();
    } catch (e) {
      Alert.alert('Could not update', e?.data?.message || e?.message || 'Try again');
    }
  };

  const confirmDelete = () => {
    if (!episode?.id) return;
    if (series?.status && ['published', 'live', 'upcoming', 'coming_soon'].includes(String(series.status).toLowerCase())) {
      Alert.alert(
        'Live series',
        'Contact the WiamEpisio team if you need an episode removed after go-live.',
      );
      return;
    }
    Alert.alert(
      'Delete episode?',
      `Remove Episode ${epNum}${episode.is_final ? ' (marked final)' : ''}? This cannot be undone — you can upload a new file afterward.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await studioEpisioApi.deleteEpisode(episode.id);
              Alert.alert('Deleted', 'Episode removed.');
              if (navigation.canGoBack()) navigation.goBack();
            } catch (e) {
              Alert.alert('Could not delete', e?.message || 'Try again');
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <EpisioScreenShell title={`Episode ${epNum || ''}`} subtitle="Loading…">
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} />
      </EpisioScreenShell>
    );
  }

  if (!episode) {
    return (
      <EpisioScreenShell
        title="Episode"
        footer={<EpisioGoldButton label="Go back" onPress={() => navigation.goBack()} />}
      >
        <Text style={styles.empty}>Episode not found.</Text>
      </EpisioScreenShell>
    );
  }

  return (
    <EpisioScreenShell
      title={`Episode ${epNum}`}
      subtitle={series?.title || 'Series'}
      footer={(
        <EpisioGoldButton label="Save Changes" onPress={save} loading={saving} />
      )}
    >
      <View style={styles.deleteRow}>
        <TouchableOpacity style={styles.iconBtn} onPress={confirmDelete}>
          <Trash2 size={15} color="#E4573D" />
        </TouchableOpacity>
      </View>

      <View style={styles.previewBlock}>
        <View style={styles.thumb}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <Play size={22} color="rgba(255,255,255,0.5)" fill="rgba(255,255,255,0.5)" />
          )}
        </View>
        {ready ? (
          <View style={styles.statusPill}>
            <Check size={10} color="#3BB273" />
            <Text style={styles.statusText}>READY</Text>
          </View>
        ) : (
          <View style={[styles.statusPill, { backgroundColor: 'rgba(212,160,23,0.14)' }]}>
            <Text style={[styles.statusText, { color: COLORS.gold }]}>
              {(episode.transcode_status || 'draft').toUpperCase()}
            </Text>
          </View>
        )}
        <EpisioGoldButton
          label="Replace Video"
          onPress={replaceVideo}
          disabled={locked}
          variant="ghost"
          style={{ marginTop: 4 }}
        />
        <EpisioGoldButton
          label={thumb ? 'Change episode cover' : 'Add episode cover (required)'}
          onPress={changeCover}
          disabled={locked}
          variant="ghost"
          style={{ marginTop: 8 }}
        />
      </View>

      <Text style={styles.fieldLabel}>Episode title</Text>
      <View style={styles.fieldBox}>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Episode title"
          placeholderTextColor={COLORS.textFaint}
        />
      </View>

      <Text style={styles.fieldLabel}>Description</Text>
      <View style={styles.fieldBox}>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={synopsis}
          onChangeText={setSynopsis}
          multiline
          numberOfLines={4}
          placeholder="What happens in this episode?"
          placeholderTextColor={COLORS.textFaint}
        />
      </View>

      <View style={styles.metaGrid}>
        <View style={styles.metaCell}>
          <Text style={styles.metaLbl}>Duration</Text>
          <Text style={styles.metaVal}>{episode.duration_seconds ? fmtDuration(episode.duration_seconds) : '—'}</Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLbl}>Resolution</Text>
          <Text style={styles.metaVal}>
            {probe.width && probe.height ? `${probe.width}×${probe.height}` : '—'}
          </Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLbl}>Size</Text>
          <Text style={styles.metaVal}>
            {probe.size_mb ? `${probe.size_mb} MB` : (probe.file_size_mb ? `${probe.file_size_mb} MB` : '—')}
          </Text>
        </View>
      </View>

      <View style={styles.toggleRow}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.toggleLabel}>Free preview episode</Text>
          <Text style={styles.hint}>
            Episodes 1–5 are free for viewers — our team sets access server-side.
          </Text>
        </View>
        <Switch
          value={freePreview}
          disabled
          trackColor={{ false: COLORS.navyLine, true: COLORS.gold }}
          thumbColor="#fff"
        />
      </View>

      {ready ? (
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Mark as final cut</Text>
          <Switch
            value={!!episode.is_final}
            onValueChange={toggleFinal}
            trackColor={{ false: COLORS.navyLine, true: COLORS.gold }}
            thumbColor="#fff"
            disabled={locked}
          />
        </View>
      ) : null}

      {episode.rejected || episode.reject_message ? (
        <View style={styles.rejectCard}>
          <Text style={styles.rejectTitle}>QC note</Text>
          <Text style={styles.rejectText}>{episode.reject_message || 'This episode needs a re-upload.'}</Text>
        </View>
      ) : null}
    </EpisioScreenShell>
  );
};

const styles = StyleSheet.create({
  deleteRow: { alignItems: 'flex-end', marginBottom: 8, marginTop: -4 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  previewBlock: { alignItems: 'center', marginBottom: 18 },
  thumb: {
    width: 120, height: 174, borderRadius: 14,
    backgroundColor: '#241a3a', borderWidth: 1, borderColor: COLORS.navyLine,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10, overflow: 'hidden',
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: 'rgba(59,178,115,0.16)', marginBottom: 10,
  },
  statusText: { fontSize: 9.5, fontFamily: FONTS.extraBold, color: '#3BB273' },
  fieldLabel: { fontSize: 11, fontFamily: FONTS.bold, color: '#fff', marginBottom: 7 },
  fieldBox: {
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 13, padding: 11, marginBottom: 14,
  },
  input: { color: '#fff', fontSize: 12.5, fontFamily: FONTS.regular, padding: 0 },
  textarea: { minHeight: 72, textAlignVertical: 'top' },
  metaGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  metaCell: {
    flex: 1, backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 12, padding: 9,
  },
  metaLbl: { fontSize: 9, fontFamily: FONTS.bold, color: COLORS.textFaint, textTransform: 'uppercase' },
  metaVal: { fontSize: 11.5, fontFamily: FONTS.bold, color: '#fff', marginTop: 3 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
    borderRadius: 13, padding: 11, marginBottom: 14,
  },
  toggleLabel: { fontSize: 12, fontFamily: FONTS.medium, color: '#E7E7F2', flex: 1, marginRight: 8 },
  hint: { fontSize: 10, color: COLORS.textFaint, fontFamily: FONTS.regular, marginTop: 4, lineHeight: 14 },
  empty: { color: COLORS.textDim, fontFamily: FONTS.regular, textAlign: 'center', marginTop: 40 },
  rejectCard: {
    backgroundColor: 'rgba(228,87,61,0.1)', borderWidth: 1, borderColor: 'rgba(228,87,61,0.3)',
    borderRadius: 14, padding: 12, marginBottom: 8,
  },
  rejectTitle: { fontFamily: FONTS.bold, color: '#E4573D', fontSize: 11, marginBottom: 4 },
  rejectText: { fontFamily: FONTS.regular, color: '#E0A79A', fontSize: 12, lineHeight: 17 },
});

export default StudioEpisodeDetailScreen;
