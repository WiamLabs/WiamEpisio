/**
 * Layout: WiamStudio-Episode-List.html
 * API: GET series detail · navigate upload / reject / mark-final
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import QualityRejectedBanner from '../../components/episio/QualityRejectedBanner';
import resolveUrl from '../../utils/resolveUrl';

const fmtDur = (sec) => {
  const s = Number(sec) || 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const statusMeta = (ep) => {
  if (ep.slot) return { label: 'Draft slot', color: COLORS.textFaint, pill: null };
  if (ep.rejected || ep.transcode_status === 'failed') {
    return { label: 'WRONG SIZE', color: '#E4573D', pill: 'reject' };
  }
  if (ep.transcode_status === 'processing' || ep.transcode_status === 'queued') {
    return { label: 'PROCESSING', color: '#6EA8FE', pill: 'proc' };
  }
  if (ep.transcode_status === 'ready' && ep.is_final) {
    return { label: 'READY', color: '#3BB273', pill: 'ready' };
  }
  if (ep.transcode_status === 'ready') {
    return { label: 'READY', color: COLORS.gold, pill: 'ready' };
  }
  if (ep.transcode_status === 'uploading') {
    return { label: 'UPLOADING', color: COLORS.gold, pill: 'up' };
  }
  return { label: (ep.transcode_status || 'draft').toUpperCase(), color: COLORS.textFaint, pill: null };
};

const StudioEpisodeListScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const seriesId = useRoute().params?.seriesId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (soft) => {
    if (!seriesId) return;
    if (!soft) setLoading(true);
    try {
      setData(await studioEpisioApi.getSeries(seriesId));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [seriesId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const series = data?.series;
  const eps = data?.episodes || [];
  const planned = series?.planned_episode_count || 0;
  const uploaded = series?.ready_episodes || 0;
  const locked = !!series?.season_locked && !series?.fix_window_open;
  const rejected = eps.filter((e) => e.rejected);

  const rows = [];
  const byNum = Object.fromEntries(eps.map((e) => [e.episode_number, e]));
  const maxShow = Math.max(planned, eps.length, 1);
  for (let n = 1; n <= maxShow; n += 1) {
    rows.push(byNum[n] || {
      id: `slot-${n}`,
      episode_number: n,
      title: `Episode ${n}`,
      transcode_status: 'draft',
      duration_seconds: 0,
      is_final: false,
      rejected: false,
      slot: true,
    });
  }

  const openEp = (ep) => {
    if (ep.rejected) {
      navigation.navigate('StudioEpisodeReject', { seriesId, episodeId: ep.id, episodeNumber: ep.episode_number });
      return;
    }
    if (!ep.slot && ep.id) {
      navigation.navigate('StudioEpisodeDetail', {
        seriesId,
        episodeId: ep.id,
        episodeNumber: ep.episode_number,
      });
      return;
    }
    navigation.navigate('StudioEpisodeUpload', {
      seriesId,
      episodeId: ep.slot ? undefined : ep.id,
      episodeNumber: ep.episode_number,
      locked,
    });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={15} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Episodes</Text>
          <Text style={styles.sub}>{series?.title || 'Series'}</Text>
        </View>
        {!locked ? (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('StudioEpisodeUpload', { seriesId })}
          >
            <Plus size={13} color={COLORS.navy} />
            <Text style={styles.addText}>Add</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.progress}>
        <Text style={styles.progressText}>
          <Text style={{ fontFamily: FONTS.bold, color: '#fff' }}>{uploaded}</Text>
          {' of '}{planned || '?'} episodes uploaded
        </Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${planned ? Math.min(100, (uploaded / planned) * 100) : 0}%` }]} />
        </View>
      </View>

      {rejected.length ? (
        <View style={{ paddingHorizontal: 20 }}>
          <QualityRejectedBanner
            variant="full"
            title={`${rejected.length} episode${rejected.length > 1 ? 's' : ''} need attention`}
            subtitle="Fix wrong size / QC fails and re-upload before you can lock or resubmit."
            ctaLabel="Review Issue"
            onPress={() => openEp(rejected[0])}
          />
        </View>
      ) : null}

      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          refreshControl={(
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={COLORS.gold} />
          )}
          renderItem={({ item: ep }) => {
            const st = statusMeta(ep);
            const thumb = resolveUrl(ep.poster_frame_url || ep.thumbnail_url);
            return (
              <TouchableOpacity
                style={[styles.row, ep.slot && styles.rowSlot, ep.rejected && styles.rowReject]}
                onPress={() => openEp(ep)}
                activeOpacity={0.85}
              >
                {thumb ? (
                  <Image source={{ uri: thumb }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, ep.slot && styles.thumbSlot]}>
                    {ep.slot ? <Plus size={14} color={COLORS.textFaint} /> : null}
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.epTitle, ep.slot && { color: COLORS.textFaint }]}>
                    EP {ep.episode_number} — {ep.slot ? 'Not uploaded' : (ep.title || 'Untitled')}
                  </Text>
                  <Text style={styles.epMeta}>
                    {ep.slot
                      ? 'Draft slot · Tap to upload'
                      : ep.rejected
                        ? (ep.reject_message || 'Video must be 9:16. Tap to fix.')
                        : `${fmtDur(ep.duration_seconds)} · ${st.label}${ep.is_final ? ' · Final' : ''}`}
                  </Text>
                </View>
                {st.pill ? (
                  <View style={[
                    styles.pill,
                    st.pill === 'ready' && styles.pillReady,
                    st.pill === 'proc' && styles.pillProc,
                    st.pill === 'reject' && styles.pillReject,
                    st.pill === 'up' && styles.pillUp,
                  ]}
                  >
                    <Text style={[styles.pillText, { color: st.color }]}>{st.label}</Text>
                  </View>
                ) : (
                  <View style={[styles.dot, { backgroundColor: st.color }]} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  h1: { fontFamily: FONTS.extraBold, color: '#fff', fontSize: 16 },
  sub: { fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 11.5, marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.gold, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
  },
  addText: { fontFamily: FONTS.bold, color: COLORS.navy, fontSize: 12 },
  progress: { paddingHorizontal: 20, marginBottom: 12 },
  progressText: { fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 12, marginBottom: 8 },
  barTrack: { height: 6, borderRadius: 4, backgroundColor: COLORS.navyCard, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: COLORS.gold },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.navyCard, borderRadius: 14, padding: 11, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  rowSlot: { borderStyle: 'dashed', opacity: 0.92 },
  rowReject: { borderColor: 'rgba(228,87,61,0.45)', backgroundColor: 'rgba(228,87,61,0.06)' },
  thumb: {
    width: 40, height: 58, borderRadius: 8,
    backgroundColor: COLORS.navySoft, alignItems: 'center', justifyContent: 'center',
  },
  thumbSlot: { borderWidth: 1, borderColor: COLORS.navyLine, borderStyle: 'dashed' },
  epTitle: { fontFamily: FONTS.bold, color: '#fff', fontSize: 12 },
  epMeta: { marginTop: 3, fontFamily: FONTS.regular, color: COLORS.textFaint, fontSize: 11 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  pillReady: { backgroundColor: 'rgba(59,178,115,0.14)' },
  pillProc: { backgroundColor: 'rgba(110,168,254,0.14)' },
  pillReject: { backgroundColor: 'rgba(228,87,61,0.14)' },
  pillUp: { backgroundColor: 'rgba(212,160,23,0.14)' },
  pillText: { fontSize: 8.5, fontFamily: FONTS.extraBold },
});

export default StudioEpisodeListScreen;
