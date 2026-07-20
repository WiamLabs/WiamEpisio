/**
 * Layout: WiamStudio-Episode-List.html
 * API: GET series detail · navigate upload / reject / mark-final
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import QualityRejectedBanner from '../../components/episio/QualityRejectedBanner';

const statusColor = (ep) => {
  if (ep.rejected || ep.transcode_status === 'failed') return COLORS.error;
  if (ep.transcode_status === 'ready' && ep.is_final) return '#3DDC97';
  if (ep.transcode_status === 'ready') return COLORS.gold;
  if (ep.transcode_status === 'processing' || ep.transcode_status === 'queued') return '#6EA8FE';
  return COLORS.textFaint;
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

  // Fill empty slots so list shows draft placeholders up to planned
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
          renderItem={({ item: ep }) => (
            <TouchableOpacity style={[styles.row, ep.rejected && styles.rowReject]} onPress={() => openEp(ep)}>
              <View style={styles.thumb} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.epTitle, ep.slot && { color: COLORS.textFaint }]}>
                  EP {ep.episode_number} — {ep.title || 'Untitled'}
                </Text>
                <Text style={styles.epMeta}>
                  {ep.slot
                    ? 'Draft slot'
                    : `${Math.floor((ep.duration_seconds || 0) / 60)}:${String((ep.duration_seconds || 0) % 60).padStart(2, '0')} · ${
                      ep.rejected ? 'Rejected' : (ep.is_final ? 'Final' : (ep.transcode_status || '—'))
                    }`}
                </Text>
              </View>
              <View style={[styles.dot, { backgroundColor: statusColor(ep) }]} />
            </TouchableOpacity>
          )}
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
  rowReject: { borderColor: 'rgba(228,87,61,0.35)' },
  thumb: {
    width: 40, height: 58, borderRadius: 8,
    backgroundColor: COLORS.navySoft || '#161634',
  },
  epTitle: { fontFamily: FONTS.bold, color: '#fff', fontSize: 12 },
  epMeta: { marginTop: 3, fontFamily: FONTS.regular, color: COLORS.textFaint, fontSize: 11 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

export default StudioEpisodeListScreen;
