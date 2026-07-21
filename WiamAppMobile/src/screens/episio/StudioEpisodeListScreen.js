/**
 * Layout: WiamStudio-Episode-List.html
 * List · delete failed · arrange/reorder · continue CTA
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, Image, Alert, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Plus, Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import studioEpisioApi from '../../api/studioEpisio';
import QualityRejectedBanner from '../../components/episio/QualityRejectedBanner';
import resolveUrl from '../../utils/resolveUrl';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  const [arrange, setArrange] = useState(false);
  const [order, setOrder] = useState([]); // episode objects in display order
  const [savingOrder, setSavingOrder] = useState(false);

  const load = useCallback(async (soft) => {
    if (!seriesId) return;
    if (!soft) setLoading(true);
    try {
      const next = await studioEpisioApi.getSeries(seriesId);
      setData(next);
      const eps = [...(next?.episodes || [])].sort(
        (a, b) => (a.episode_number || 0) - (b.episode_number || 0),
      );
      setOrder(eps);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [seriesId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const series = data?.series;
  const planned = series?.planned_episode_count || 0;
  const uploaded = series?.ready_episodes || 0;
  const locked = !!series?.season_locked && !series?.fix_window_open;
  const rejected = order.filter((e) => e.rejected);

  // Real episodes first (contiguous numbers from server), empty plan slots only at the end
  const rows = useMemo(() => {
    const list = arrange ? order : [...order].sort(
      (a, b) => (a.episode_number || 0) - (b.episode_number || 0),
    );
    const out = list.map((ep, idx) => (
      arrange ? { ...ep, episode_number: idx + 1 } : ep
    ));
    if (!arrange) {
      const need = Math.max(0, planned - list.length);
      for (let i = 0; i < need; i += 1) {
        const n = list.length + i + 1;
        out.push({
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
    }
    return out;
  }, [order, planned, arrange]);

  const openEp = (ep) => {
    if (arrange) return;
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

  const confirmDeleteEp = (ep) => {
    if (!ep?.id || ep.slot) return;
    Alert.alert(
      'Delete failed episode?',
      `Remove EP ${ep.episode_number}? The list will close the gap and renumber automatically.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await studioEpisioApi.deleteEpisode(ep.id);
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              await load(true);
            } catch (e) {
              Alert.alert('Could not delete', e?.message || 'Try again');
            }
          },
        },
      ],
    );
  };

  const moveEp = (index, dir) => {
    const next = index + dir;
    if (next < 0 || next >= order.length) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOrder((prev) => {
      const copy = [...prev];
      const tmp = copy[index];
      copy[index] = copy[next];
      copy[next] = tmp;
      return copy;
    });
  };

  const saveOrder = async () => {
    if (!seriesId || !order.length) {
      setArrange(false);
      return;
    }
    setSavingOrder(true);
    try {
      const dataOut = await studioEpisioApi.reorderEpisodes(
        seriesId,
        order.map((e) => e.id),
      );
      if (dataOut?.episodes) {
        setOrder(dataOut.episodes);
        setData((d) => ({ ...d, episodes: dataOut.episodes, series: dataOut.series || d?.series }));
      } else {
        await load(true);
      }
      setArrange(false);
    } catch (e) {
      Alert.alert('Could not save order', e?.message || 'Try again');
    } finally {
      setSavingOrder(false);
    }
  };

  const toggleArrange = () => {
    if (locked) {
      Alert.alert('Season locked', 'Reorder opens again when Needs Changes unlocks edits.');
      return;
    }
    if (arrange) {
      saveOrder();
      return;
    }
    if (order.length < 2) {
      Alert.alert('Arrange', 'Add at least two episodes to rearrange.');
      return;
    }
    setArrange(true);
  };

  const planMet = planned > 0 && uploaded >= planned;
  const hasReady = uploaded > 0;
  const canContinue = hasReady && !rejected.length && !locked && !arrange;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => {
            if (arrange) {
              Alert.alert('Discard arrange?', 'Leave without saving the new order?', [
                { text: 'Keep arranging', style: 'cancel' },
                {
                  text: 'Discard',
                  style: 'destructive',
                  onPress: () => { setArrange(false); load(true); },
                },
              ]);
              return;
            }
            navigation.goBack();
          }}
        >
          <ChevronLeft size={15} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>{arrange ? 'Arrange episodes' : 'Episodes'}</Text>
          <Text style={styles.sub}>
            {arrange ? 'Move up / down · tap Done to save' : (series?.title || 'Series')}
          </Text>
        </View>
        {!locked ? (
          <TouchableOpacity
            style={[styles.addBtn, arrange && styles.doneBtn]}
            onPress={arrange ? saveOrder : toggleArrange}
            disabled={savingOrder}
          >
            {savingOrder ? (
              <ActivityIndicator color={COLORS.navy} size="small" />
            ) : (
              <Text style={styles.addText}>{arrange ? 'Done' : 'Arrange'}</Text>
            )}
          </TouchableOpacity>
        ) : null}
        {!locked && !arrange ? (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('StudioEpisodeUpload', { seriesId })}
          >
            <Plus size={13} color={COLORS.navy} />
            <Text style={styles.addText}>Add</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {!arrange ? (
        <View style={styles.progress}>
          <Text style={styles.progressText}>
            <Text style={{ fontFamily: FONTS.bold, color: '#fff' }}>{uploaded}</Text>
            {' of '}{planned || '?'} episodes uploaded
            {planned ? ' · Add more anytime if your story grows' : ''}
          </Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${planned ? Math.min(100, (uploaded / planned) * 100) : 0}%` }]} />
          </View>
        </View>
      ) : (
        <Text style={styles.arrangeHint}>
          Swap positions like a playlist — EP numbers update when you tap Done.
        </Text>
      )}

      {!arrange && rejected.length ? (
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
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: canContinue ? 140 : 40 }}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={COLORS.gold}
              enabled={!arrange}
            />
          )}
          ListFooterComponent={planMet && !rejected.length && !arrange ? (
            <Text style={styles.nextHint}>
              Planned count reached. Next: Completeness checklist → trailer/cover → Submit for live.
            </Text>
          ) : null}
          renderItem={({ item: ep, index }) => {
            const st = statusMeta(ep);
            const thumb = resolveUrl(ep.poster_url || ep.thumbnail_url);
            const showDelete = !arrange && !ep.slot && !!ep.id && !!ep.rejected;
            const realIndex = arrange ? index : -1;
            return (
              <View style={[
                styles.row,
                ep.slot && styles.rowSlot,
                ep.rejected && styles.rowReject,
                arrange && styles.rowArrange,
              ]}
              >
                {arrange && !ep.slot ? (
                  <View style={styles.gripCol}>
                    <GripVertical size={16} color={COLORS.gold} />
                    <View style={styles.moveCol}>
                      <TouchableOpacity
                        style={[styles.moveBtn, realIndex === 0 && styles.moveBtnOff]}
                        onPress={() => moveEp(realIndex, -1)}
                        disabled={realIndex === 0}
                      >
                        <ChevronUp size={16} color={realIndex === 0 ? COLORS.textFaint : '#fff'} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.moveBtn, realIndex >= order.length - 1 && styles.moveBtnOff]}
                        onPress={() => moveEp(realIndex, 1)}
                        disabled={realIndex >= order.length - 1}
                      >
                        <ChevronDown size={16} color={realIndex >= order.length - 1 ? COLORS.textFaint : '#fff'} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={styles.rowMain}
                  onPress={() => openEp(ep)}
                  activeOpacity={arrange ? 1 : 0.85}
                  disabled={arrange}
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
                          ? (ep.reject_message || 'Wrong size — tap to fix or delete.')
                          : `${fmtDur(ep.duration_seconds)} · ${st.label}${ep.is_final ? ' · Final' : ''}`}
                    </Text>
                  </View>
                  {!arrange && st.pill ? (
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
                  ) : null}
                </TouchableOpacity>
                {showDelete ? (
                  <TouchableOpacity
                    style={styles.trashBtn}
                    onPress={() => confirmDeleteEp(ep)}
                    hitSlop={10}
                  >
                    <Trash2 size={15} color="#E4573D" />
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          }}
        />
      )}

      {canContinue ? (
        <View style={[styles.continueBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <Text style={styles.continueHint}>
            {planMet
              ? 'Episodes ready — continue to Completeness, then Submit for live.'
              : 'You can keep adding episodes, or continue to Completeness anytime.'}
          </Text>
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={() => navigation.navigate('StudioCompleteness', { seriesId })}
            activeOpacity={0.9}
          >
            <Text style={styles.continueBtnText}>Continue → Completeness</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.workspaceLink}
            onPress={() => navigation.navigate('StudioSeriesDetail', { seriesId })}
          >
            <Text style={styles.workspaceLinkText}>Back to series workspace</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
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
  doneBtn: { backgroundColor: '#3BB273' },
  addText: { fontFamily: FONTS.bold, color: COLORS.navy, fontSize: 12 },
  progress: { paddingHorizontal: 20, marginBottom: 12 },
  progressText: { fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 12, marginBottom: 8 },
  barTrack: { height: 6, borderRadius: 4, backgroundColor: COLORS.navyCard, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: COLORS.gold },
  arrangeHint: {
    marginHorizontal: 20, marginBottom: 12, fontFamily: FONTS.medium,
    color: COLORS.gold, fontSize: 12, lineHeight: 17,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.navyCard, borderRadius: 14, padding: 11, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.navyLine,
  },
  rowArrange: { borderColor: 'rgba(212,160,23,0.35)' },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  gripCol: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  moveCol: { gap: 2 },
  moveBtn: {
    width: 28, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.navySoft,
  },
  moveBtnOff: { opacity: 0.35 },
  trashBtn: {
    width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(228,87,61,0.12)',
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
  pill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  pillReady: { backgroundColor: 'rgba(59,178,115,0.14)' },
  pillProc: { backgroundColor: 'rgba(110,168,254,0.14)' },
  pillReject: { backgroundColor: 'rgba(228,87,61,0.14)' },
  pillUp: { backgroundColor: 'rgba(212,160,23,0.14)' },
  pillText: { fontSize: 8.5, fontFamily: FONTS.extraBold },
  nextHint: {
    fontFamily: FONTS.medium, color: COLORS.textDim, fontSize: 12, lineHeight: 18,
    marginTop: 8, marginBottom: 12, textAlign: 'center',
  },
  continueBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: COLORS.navy,
    borderTopWidth: 1, borderTopColor: COLORS.navyLine,
  },
  continueHint: {
    fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 12, lineHeight: 17, marginBottom: 10,
  },
  continueBtn: {
    backgroundColor: COLORS.gold, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  continueBtnText: { fontFamily: FONTS.extraBold, color: COLORS.navy, fontSize: 14 },
  workspaceLink: { paddingVertical: 12, alignItems: 'center' },
  workspaceLinkText: { fontFamily: FONTS.semi, color: COLORS.textDim, fontSize: 13 },
});

export default StudioEpisodeListScreen;
