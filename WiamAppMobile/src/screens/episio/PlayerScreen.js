/**
 * YouTube-style player from WiamEpisio-Player.html — contained frame + info panel.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Dimensions, StatusBar as RNStatusBar, Share, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  ChevronLeft, Maximize2, SkipBack, SkipForward, Heart, MessageCircle, Share2, List, Download,
} from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import episodesApi from '../../api/episodes';
import apiClient from '../../api/client';
import studioEpisioApi from '../../api/studioEpisio';
import walletApi from '../../api/wallet';
import useAuthStore from '../../store/useAuthStore';
import CONFIG from '../../constants/config';
import { assertGuestCanWatchSeries } from '../../utils/guestSeriesGate';
import WatchRewardRing from '../../components/episio/WatchRewardRing';

const { width: W } = Dimensions.get('window');
const FRAME_H = Math.min(W * (16 / 9) * 0.58, W * 1.15);

const PlayerScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { episodeId, seriesId, offlineUri, startFullscreen } = route.params || {};
  const [meta, setMeta] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [streamUrl, setStreamUrl] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(!!startFullscreen);
  const [liked, setLiked] = useState(false);
  const [listMsg, setListMsg] = useState(null);
  const [watchProgress, setWatchProgress] = useState(0);
  const [rewardPaused, setRewardPaused] = useState(false);
  const [rewardGranted, setRewardGranted] = useState(false);
  const [rewardToast, setRewardToast] = useState(null);
  const rewardedRef = useRef(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const player = useVideoPlayer(streamUrl || '', (p) => {
    p.loop = false;
    if (streamUrl) p.play();
  });

  useEffect(() => {
    if (streamUrl && player) {
      try {
        player.replace(streamUrl);
        player.play();
      } catch {
        /* ignore */
      }
    }
  }, [streamUrl, player]);

  const load = useCallback(async () => {
    if (!episodeId) {
      setError('Missing episode');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (offlineUri) {
        setStreamUrl(offlineUri);
        setMeta({
          seriesTitle: route.params?.seriesTitle || 'Downloaded',
          episodeNumber: route.params?.episodeNumber,
          total: null,
          synopsis: '',
        });
        setLoading(false);
        return;
      }
      if (seriesId) {
        const gate = await assertGuestCanWatchSeries(seriesId, isAuthenticated);
        if (!gate.allowed) {
          setLoading(false);
          navigation.replace('LoginRequiredSheet', {
            title: 'Register to watch more',
            message: 'As a guest you can finish one series. Sign in free to watch a different series.',
          });
          return;
        }
      }
      let series = null;
      let eps = [];
      if (seriesId) {
        const [s, e] = await Promise.all([
          episodesApi.getSeries(seriesId),
          episodesApi.listEpisodes(seriesId),
        ]);
        series = s?.series || s;
        eps = e?.episodes || e?.items || [];
        setEpisodes(eps);
      }
      const stream = await episodesApi.getStream(episodeId);
      const url = stream?.url || stream?.hls_url || stream?.playback_url || stream?.signed_url;
      if (!url) throw new Error('No stream URL');
      setStreamUrl(url);
      const ep = eps.find((x) => x.id === episodeId) || stream.episode || {};
      setMeta({
        seriesTitle: series?.title || stream?.series?.title || 'Episode',
        episodeNumber: ep.episode_number || stream?.episode_number,
        total: series?.total_episodes || eps.length,
        synopsis: ep.synopsis || series?.description || '',
      });
      episodesApi.saveProgress({
        episode_id: episodeId,
        content_id: seriesId,
        position_seconds: 0,
      }).catch(() => {});
    } catch (e) {
      if (e?.locked || e?.loginRequired) {
        navigation.replace('UnlockTakeover', {
          episodeId,
          seriesId,
          unlockPrice: e.unlock_price_coins || 10,
          reason: e.reason || e.message,
          episodeNumber: e.episode_number || meta?.episodeNumber,
          seriesTitle: meta?.seriesTitle || e.series_title,
          synopsis: meta?.synopsis || e.message,
        });
        return;
      }
      setError(typeof e === 'string' ? e : (e?.message || 'Playback failed'));
    } finally {
      setLoading(false);
    }
  }, [episodeId, seriesId, navigation, isAuthenticated]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    rewardedRef.current = false;
    setWatchProgress(0);
    setRewardGranted(false);
    setRewardToast(null);
  }, [episodeId]);

  useEffect(() => {
    if (!player || !streamUrl) return undefined;
    const tick = setInterval(() => {
      try {
        const dur = Number(player.duration) || 0;
        const cur = Number(player.currentTime) || 0;
        if (dur > 0) {
          const p = Math.min(1, cur / dur);
          setWatchProgress(p);
          if (p >= 0.9 && !rewardedRef.current && isAuthenticated) {
            rewardedRef.current = true;
            episodesApi.saveProgress({
              episode_id: episodeId,
              content_id: seriesId,
              position_seconds: Math.floor(cur),
              completed: true,
            }).catch(() => {});
            walletApi.claimWatchComplete(episodeId, seriesId).then((res) => {
              if (res?.paused) {
                setRewardPaused(true);
                return;
              }
              setRewardPaused(false);
              if (res?.granted) {
                setRewardGranted(true);
                setRewardToast(`+${res.coins || 2} coins`);
                setTimeout(() => setRewardToast(null), 2200);
              }
              if (res?.series_finish?.granted) {
                setRewardToast(`+${res.series_finish.coins} series finish`);
                setTimeout(() => setRewardToast(null), 2600);
              }
            }).catch(() => {
              rewardedRef.current = false;
            });
          }
        }
      } catch { /* ignore */ }
    }, 500);
    return () => clearInterval(tick);
  }, [player, streamUrl, episodeId, seriesId, isAuthenticated]);

  const goEp = (ep) => {
    if (!ep) return;
    if (ep.locked) {
      navigation.navigate('UnlockTakeover', {
        episodeId: ep.id,
        seriesId,
        unlockPrice: ep.unlock_price_coins || 10,
        episodeNumber: ep.episode_number,
        seriesTitle: meta?.seriesTitle,
        synopsis: ep.synopsis || meta?.synopsis,
      });
      return;
    }
    navigation.replace('Player', {
      episodeId: ep.id,
      seriesId,
      seriesTitle: meta?.seriesTitle,
      synopsis: meta?.synopsis,
      episodeNumber: ep.episode_number,
    });
  };

  const requireAuth = (next) => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    next();
  };

  const onLike = () => requireAuth(async () => {
    if (!seriesId) return;
    try {
      await studioEpisioApi.remind(seriesId);
      setLiked(true);
      Alert.alert('Saved', 'Added to My List reminders.');
    } catch (e) {
      Alert.alert('Could not save', e?.message || 'Try again');
    }
  });

  const onComment = () => {
    if (seriesId) navigation.navigate('SeriesComments', { seriesId });
  };

  const onDownload = () => {
    if (!isAuthenticated) {
      navigation.navigate('LoginRequiredSheet', {
        title: 'Sign up to download',
        message: 'Offline downloads need a free email account. Guests can watch (one series) but cannot save videos offline.',
        returnTo: 'DownloadsManager',
      });
      return;
    }
    navigation.navigate('DownloadsManager', {
      pendingDownload: {
        episodeId,
        seriesId,
        seriesTitle: meta?.seriesTitle,
        episodeNumber: meta?.episodeNumber,
      },
    });
  };

  const onShare = async () => {
    const title = meta?.seriesTitle || 'WiamEpisio';
    const url = `${CONFIG.SITE_ORIGIN}/series/${seriesId || ''}`;
    try {
      await Share.share({
        message: `Watch ${title} on WiamEpisio\n${url}`,
        url,
        title,
      });
      if (seriesId) {
        apiClient.post(`/series/${seriesId}/share`, {}).catch(() => {});
      }
    } catch { /* user cancelled */ }
  };

  const onMyList = () => requireAuth(async () => {
    if (!seriesId) return;
    try {
      await studioEpisioApi.remind(seriesId);
      setListMsg('Saved to My List');
    } catch (e) {
      Alert.alert('My List', e?.message || 'Could not save');
    }
  });

  const currentIdx = episodes.findIndex((e) => e.id === episodeId);
  const prev = currentIdx > 0 ? episodes[currentIdx - 1] : null;
  const next = currentIdx >= 0 && currentIdx < episodes.length - 1 ? episodes[currentIdx + 1] : null;

  return (
    <View style={[styles.root, { paddingTop: fullscreen ? 0 : insets.top }]}>
      <StatusBar style="light" hidden={fullscreen} />
      {fullscreen ? <RNStatusBar hidden /> : null}

      <View style={[styles.frame, fullscreen && styles.frameFull, !fullscreen && { height: FRAME_H }]}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={COLORS.gold} size="large" /></View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.error}>{error}</Text>
            <TouchableOpacity onPress={load}><Text style={styles.retry}>Retry</Text></TouchableOpacity>
          </View>
        ) : streamUrl ? (
          <>
            <VideoView
              style={StyleSheet.absoluteFill}
              player={player}
              allowsFullscreen
              allowsPictureInPicture
              contentFit="contain"
              nativeControls
            />
            {isAuthenticated ? (
              <View style={styles.rewardRing}>
                <WatchRewardRing
                  progress={watchProgress}
                  paused={rewardPaused}
                  granted={rewardGranted}
                />
              </View>
            ) : null}
            {rewardToast ? (
              <View style={styles.rewardToast}>
                <Text style={styles.rewardToastText}>{rewardToast}</Text>
              </View>
            ) : null}
          </>
        ) : null}

        <View style={[styles.videoTop, { top: fullscreen ? insets.top + 8 : 10 }]}>
          <TouchableOpacity style={styles.vtBtn} onPress={() => navigation.goBack()}>
            <ChevronLeft size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.vtBtn}
            onPress={() => setFullscreen((f) => !f)}
          >
            <Maximize2 size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        {!fullscreen && meta ? (
          <View style={styles.controlsHint}>
            <View style={styles.crLeft}>
              <TouchableOpacity onPress={() => goEp(prev)} disabled={!prev}>
                <SkipBack size={18} color={prev ? '#fff' : '#555'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => goEp(next)} disabled={!next}>
                <SkipForward size={18} color={next ? '#fff' : '#555'} />
              </TouchableOpacity>
              <Text style={styles.epMini}>
                EP {meta.episodeNumber || '?'}
                {meta.total ? ` of ${meta.total}` : ''}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {!fullscreen ? (
        <ScrollView style={styles.info} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          <Text style={styles.seriesTitle}>{meta?.seriesTitle}</Text>
          <Text style={styles.epMeta}>
            {meta?.episodeNumber ? `EP.${meta.episodeNumber} · ` : ''}
            {meta?.synopsis || ''}
          </Text>

          <View style={styles.actionStrip}>
            {[
              { Icon: Heart, label: 'Like', onPress: onLike, active: liked },
              { Icon: MessageCircle, label: 'Comment', onPress: onComment },
              { Icon: Share2, label: 'Share', onPress: onShare },
              { Icon: Download, label: 'Save', onPress: onDownload },
              { Icon: List, label: 'List', onPress: onMyList },
            ].map(({ Icon, label, onPress, active }) => (
              <TouchableOpacity key={label} style={styles.actionItem} onPress={onPress} activeOpacity={0.7}>
                <Icon size={20} color={active ? COLORS.gold : '#C9C9DE'} fill={active ? COLORS.gold : 'transparent'} />
                <Text style={[styles.actionLabel, active && { color: COLORS.gold }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {listMsg ? <Text style={styles.listMsg}>{listMsg}</Text> : null}

          <TouchableOpacity
            style={styles.vipBanner}
            onPress={() => navigation.navigate('VipCheckout')}
            activeOpacity={0.85}
          >
            <Text style={styles.vipBannerText}>VIP — watch every episode without coins</Text>
          </TouchableOpacity>

          {episodes.length ? (
            <>
              <Text style={styles.epStripLabel}>Episodes</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {episodes.map((ep) => {
                  const current = ep.id === episodeId;
                  return (
                    <TouchableOpacity
                      key={ep.id}
                      style={[styles.epChip, current && styles.epChipCurrent]}
                      onPress={() => goEp(ep)}
                    >
                      <Text style={[styles.epChipText, current && { color: COLORS.gold }]}>
                        {ep.episode_number}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          ) : null}
        </ScrollView>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  frame: {
    width: '100%',
    backgroundColor: '#0d0d24',
    overflow: 'hidden',
  },
  frameFull: { flex: 1 },
  rewardRing: {
    position: 'absolute', top: 14, right: 14, zIndex: 6,
  },
  rewardToast: {
    position: 'absolute', bottom: 18, alignSelf: 'center', zIndex: 7,
    backgroundColor: 'rgba(212,160,23,0.95)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  rewardToastText: { fontFamily: FONTS.bold, fontSize: 12, color: COLORS.navy },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: COLORS.error, fontFamily: FONTS.medium, textAlign: 'center', marginBottom: 12 },
  retry: { color: COLORS.gold, fontFamily: FONTS.semi },
  videoTop: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 4,
  },
  vtBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsHint: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    zIndex: 4,
  },
  crLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  epMini: { fontSize: 11, color: '#fff', fontFamily: FONTS.semi },
  info: { flex: 1, backgroundColor: COLORS.navy, paddingHorizontal: 18, paddingTop: 16 },
  seriesTitle: { fontSize: 15.5, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 4 },
  epMeta: {
    fontSize: 11.5,
    color: '#8B8BA3',
    lineHeight: 18,
    fontFamily: FONTS.regular,
    marginBottom: 14,
  },
  actionStrip: {
    flexDirection: 'row',
    gap: 22,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1a1a3a',
    marginBottom: 16,
  },
  actionItem: { alignItems: 'center', gap: 4 },
  actionLabel: { fontSize: 10, color: '#8B8BA3', fontFamily: FONTS.regular },
  listMsg: { color: COLORS.gold, fontFamily: FONTS.medium, fontSize: 12, marginBottom: 12 },
  vipBanner: {
    backgroundColor: 'rgba(212,160,23,0.12)', borderWidth: 1, borderColor: COLORS.gold,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 16,
  },
  vipBannerText: { color: COLORS.gold, fontFamily: FONTS.bold, fontSize: 12.5, textAlign: 'center' },
  epStripLabel: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 10,
  },
  epChip: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  epChipCurrent: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(212,160,23,0.1)',
  },
  epChipText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.text },
});

export default PlayerScreen;
