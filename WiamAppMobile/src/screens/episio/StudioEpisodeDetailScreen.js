/**
 * Layout: WiamStudio-Episode-Detail.html
 * Load series · edit title/synopsis · replace video · save / mark final
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Check, Play, Trash2 } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';

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
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { seriesId, episodeId, episodeNumber } = useRoute().params || {};
  const [episode, setEpisode] = useState(null);
  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [freePreview, setFreePreview] = useState(false);
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
        setFreePreview((ep.episode_number || 0) <= 5);
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
      Alert.alert(
        'Saved locally',
        e?.message || 'Episode patch API unavailable — your edits are on this device until you upload again.',
      );
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

  const toggleFinal = async (val) => {
    if (!episode?.id || !ready) return;
    try {
      await studioEpisioApi.markFinal(episode.id, val);
      await load();
    } catch (e) {
      Alert.alert('Could not update', e?.message || 'Try again');
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete episode',
      'Contact the WiamEpisio team if you need an episode removed after lock.',
      [{ text: 'OK' }],
    );
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.gold} />
      </View>
    );
  }

  if (!episode) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top, paddingHorizontal: 24 }]}>
        <Text style={styles.empty}>Episode not found.</Text>
        <TouchableOpacity style={styles.cta} onPress={() => navigation.goBack()}>
          <Text style={styles.ctaText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={15} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.h1}>Episode {epNum}</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={confirmDelete}>
          <Trash2 size={15} color="#E4573D" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.left}>
          <View style={styles.thumb}>
            <Play size={22} color="rgba(255,255,255,0.5)" fill="rgba(255,255,255,0.5)" />
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
          <TouchableOpacity style={styles.replaceBtn} onPress={replaceVideo} disabled={locked}>
            <Text style={styles.replaceText}>Replace Video</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.right}>
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
              <Text style={styles.metaLbl}>Final</Text>
              <Text style={styles.metaVal}>{episode.is_final ? 'Yes' : 'Draft'}</Text>
            </View>
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Free preview episode</Text>
            <Switch
              value={freePreview}
              onValueChange={setFreePreview}
              trackColor={{ false: COLORS.navyLine, true: COLORS.gold }}
              thumbColor="#fff"
            />
          </View>
          {freePreview ? (
            <Text style={styles.hint}>Episodes 1–5 are free for viewers — our team sets access server-side.</Text>
          ) : null}

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
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity style={styles.cta} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color={COLORS.navy} /> : <Text style={styles.ctaText}>Save Changes</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  center: { alignItems: 'center', justifyContent: 'center' },
  topbar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingBottom: 12,
  },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  h1: { flex: 1, fontFamily: FONTS.extraBold, color: '#fff', fontSize: 16 },
  scroll: { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 20, gap: 16 },
  left: { width: 104 },
  right: { flex: 1, minWidth: 0 },
  thumb: {
    width: 104, height: 150, borderRadius: 14,
    backgroundColor: '#241a3a', borderWidth: 1, borderColor: COLORS.navyLine,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    padding: 5, borderRadius: 8, backgroundColor: 'rgba(59,178,115,0.16)', marginBottom: 10,
  },
  statusText: { fontSize: 9.5, fontFamily: FONTS.extraBold, color: '#3BB273' },
  replaceBtn: {
    padding: 9, borderRadius: 10, backgroundColor: COLORS.navyCard,
    borderWidth: 1, borderColor: COLORS.navyLine, alignItems: 'center',
  },
  replaceText: { fontSize: 10.5, fontFamily: FONTS.bold, color: '#C9C9DE' },
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
  hint: { fontSize: 10, color: COLORS.textFaint, fontFamily: FONTS.regular, marginTop: -8, marginBottom: 12 },
  footer: { paddingHorizontal: 20, paddingTop: 12 },
  cta: {
    padding: 16, borderRadius: 16, backgroundColor: COLORS.gold, alignItems: 'center',
    shadowColor: COLORS.gold, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  ctaText: { fontSize: 15, fontFamily: FONTS.extraBold, color: COLORS.navy },
  empty: { color: COLORS.textDim, fontFamily: FONTS.regular, textAlign: 'center', marginBottom: 16 },
});

export default StudioEpisodeDetailScreen;
