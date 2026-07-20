/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
/**
 * PlayerScreen — WiamEpisio vertical episode player (html/player.html).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft, ChevronUp, Heart, MessageCircle, Share2, X, Play,
} from 'lucide-react-native';
import { EPISIO, EPISIO_FONTS, EPISIO_RADIUS } from '../../constants/episioTheme';
import episodesApi from '../../api/episodes';
import VerticalVideoPlayer from '../../components/player/VerticalVideoPlayer';
import UnlockGate from '../../components/player/UnlockGate';
import FreeRing from '../../components/watch/FreeRing';
import { lightTap } from '../../utils/haptics';
import useAuthStore from '../../store/useAuthStore';

const { height: SCREEN_H } = Dimensions.get('window');

const PlayerScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { seriesId, episodeId: initialEpisodeId } = route.params || {};
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [series, setSeries] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [index, setIndex] = useState(0);
  const [streamUrl, setStreamUrl] = useState(null);
  const [loadingStream, setLoadingStream] = useState(true);
  const [paused, setPaused] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ currentTime: 0, duration: 0 });
  const [uiVisible, setUiVisible] = useState(true);
  const [showUpNext, setShowUpNext] = useState(false);
  const lastSaveRef = useRef(0);
  const endedRef = useRef(false);

  const episode = episodes[index] || null;
  const freeN = series?.free_episode_count ?? 5;
  const total = series?.total_episodes || episodes.length || 24;
  const freePct = total > 0 ? Math.round((freeN / total) * 100) : 21;
  const nextEp = episodes[index + 1] || null;

  const loadCatalog = useCallback(async () => {
    if (!seriesId) {
      setError('Missing series');
      return;
    }
    try {
      const [sRes, eRes] = await Promise.all([
        episodesApi.getSeries(seriesId),
        episodesApi.listEpisodes(seriesId),
      ]);
      setSeries(sRes?.series || null);
      const list = eRes?.episodes || [];
      setEpisodes(list);
      let idx = 0;
      if (initialEpisodeId) {
        const found = list.findIndex((e) => e.id === initialEpisodeId);
        if (found >= 0) idx = found;
      }
      setIndex(idx);
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Could not load series');
    }
  }, [seriesId, initialEpisodeId]);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  const loadStream = useCallback(async (ep) => {
    if (!ep) return;
    setLoadingStream(true);
    setError(null);
    setStreamUrl(null);
    setLocked(false);
    setShowUpNext(false);
    endedRef.current = false;
    try {
      if (ep.locked) {
        setLocked(true);
        setLoadingStream(false);
        return;
      }
      const res = await episodesApi.getStream(ep.id);
      setStreamUrl(res?.stream?.manifest_url || null);
      setLocked(false);
    } catch (e) {
      if (e?.locked || e?.message === 'locked' || e?.loginRequired) {
        setLocked(true);
        setError(null);
      } else {
        setError(typeof e === 'string' ? e : e?.message || 'Could not start stream');
      }
    } finally {
      setLoadingStream(false);
    }
  }, []);

  useEffect(() => {
    if (episode) loadStream(episode);
  }, [episode?.id, loadStream]);

  const saveProgress = useCallback(async (seconds, completed = false) => {
    if (!episode?.id || !isAuthenticated) return;
    const now = Date.now();
    if (!completed && now - lastSaveRef.current < 4000) return;
    lastSaveRef.current = now;
    try {
      await episodesApi.saveProgress({
        episode_id: episode.id,
        seconds_watched: Math.floor(seconds),
        completed,
      });
    } catch {
      /* best-effort */
    }
  }, [episode?.id, isAuthenticated]);

  const onProgress = useCallback(({ currentTime, duration }) => {
    setProgress({ currentTime, duration });
    saveProgress(currentTime, false);
  }, [saveProgress]);

  const goTo = useCallback((nextIdx) => {
    if (nextIdx < 0 || nextIdx >= episodes.length) return;
    lightTap();
    setPaused(false);
    setProgress({ currentTime: 0, duration: 0 });
    setIndex(nextIdx);
  }, [episodes.length]);

  const onEnd = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    saveProgress(progress.duration || progress.currentTime, true);
    if (nextEp) {
      setShowUpNext(true);
      setTimeout(() => {
        if (endedRef.current) goTo(index + 1);
      }, 3000);
    } else {
      setPaused(true);
    }
  }, [index, goTo, saveProgress, progress, nextEp]);

  const handleUnlock = async () => {
    if (!episode) return;
    if (!isAuthenticated) {
      return;
    }
    await episodesApi.unlockEpisode(episode.id);
    const eRes = await episodesApi.listEpisodes(seriesId);
    setEpisodes(eRes?.episodes || []);
    await loadStream({ ...episode, locked: false });
  };

  const fmt = (s) => {
    const n = Math.max(0, Math.floor(s || 0));
    const m = Math.floor(n / 60);
    const sec = n % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const scrubPct = progress.duration > 0
    ? Math.min(100, (progress.currentTime / progress.duration) * 100)
    : 0;

  if (error && !episode && !locked) {
    return (
      <View style={[styles.page, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.err}>{error}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <StatusBar hidden={!uiVisible} />
      <View style={{ flex: 1, minHeight: SCREEN_H * 0.85 }}>
        {locked && episode ? (
          <UnlockGate
            episodeNumber={episode.episode_number}
            priceCoins={episode.unlock_price_coins || 10}
            freeEpisodeCount={freeN}
            needLogin={!isAuthenticated}
            onUnlock={handleUnlock}
            onSignUp={() => openAuth('Register')}
            onBack={() => navigation.goBack()}
          />
        ) : (
          <VerticalVideoPlayer
            uri={streamUrl}
            paused={paused}
            loading={loadingStream}
            onTogglePause={() => {
              setPaused((p) => !p);
              setUiVisible(true);
            }}
            onProgress={onProgress}
            onEnd={onEnd}
          />
        )}

        {uiVisible && !locked ? (
          <>
            <View style={[styles.topOverlay, { top: insets.top + 8 }]}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
                <ChevronLeft size={18} color={EPISIO.paper} />
              </TouchableOpacity>
              <View style={styles.epBadge}>
                <Text style={styles.badgeSeries} numberOfLines={1}>{series?.title || 'Series'}</Text>
                <Text style={styles.badgeEp}>
                  Ep {episode?.episode_number || '?'} of {total}
                </Text>
              </View>
            </View>

            {paused ? (
              <View style={styles.centerPlay} pointerEvents="none">
                <Play size={26} color={EPISIO.paper} fill={EPISIO.paper} />
              </View>
            ) : null}

            <View style={[styles.actionRail, { bottom: 190 + insets.bottom }]}>
              <View style={styles.actionItem}>
                <View style={styles.actionCircle}><Heart size={19} color={EPISIO.paper} /></View>
                <Text style={styles.actionCount}>—</Text>
              </View>
              <View style={styles.actionItem}>
                <View style={styles.actionCircle}><MessageCircle size={19} color={EPISIO.paper} /></View>
                <Text style={styles.actionCount}>—</Text>
              </View>
              <View style={styles.actionItem}>
                <View style={styles.actionCircle}><Share2 size={19} color={EPISIO.paper} /></View>
                <Text style={styles.actionCount}>Share</Text>
              </View>
              <FreeRing pct={freePct} size={42} label={`${freeN}/${total}\nfree`} />
            </View>

            <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 12 }]}>
              {showUpNext && nextEp ? (
                <View style={styles.upNext}>
                  <FreeRing pct={70} size={28} label="3s" />
                  <View style={styles.upNextThumb}>
                    <Play size={14} color={EPISIO.smoke} fill={EPISIO.smoke} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.upNextTitle}>Up next · Episode {nextEp.episode_number}</Text>
                    <Text style={styles.upNextSub} numberOfLines={1}>
                      {nextEp.title || 'Autoplay'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.iconBtn, { width: 28, height: 28 }]}
                    onPress={() => {
                      endedRef.current = false;
                      setShowUpNext(false);
                    }}
                  >
                    <X size={13} color={EPISIO.paper} />
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={styles.watchInfo}>
                <Text style={styles.watchTitle} numberOfLines={1}>
                  {episode?.title || `Episode ${episode?.episode_number}`}
                </Text>
                <Text style={styles.watchSeries}>
                  Episode {episode?.episode_number} · {series?.title}
                </Text>
              </View>

              <View style={styles.scrub}>
                <View style={[styles.scrubFill, { width: `${scrubPct}%` }]} />
              </View>
              <View style={styles.scrubTime}>
                <Text style={styles.time}>{fmt(progress.currentTime)}</Text>
                <Text style={styles.time}>{fmt(progress.duration)}</Text>
              </View>

              <TouchableOpacity
                style={styles.swipeHint}
                onPress={() => nextEp && goTo(index + 1)}
                disabled={!nextEp}
              >
                <ChevronUp size={12} color={EPISIO.smokeDim} />
                <Text style={styles.swipeText}>
                  {nextEp ? 'Swipe up for next episode' : 'Last episode'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0B0A08' },
  center: { alignItems: 'center', justifyContent: 'center' },
  err: { color: EPISIO.coral, marginBottom: 12, textAlign: 'center', fontFamily: EPISIO_FONTS.ui },
  link: { color: EPISIO.ember, fontFamily: EPISIO_FONTS.uiBold },
  topOverlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 3,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  epBadge: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: EPISIO_RADIUS.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    maxWidth: 200,
  },
  badgeSeries: { fontSize: 11, color: EPISIO.smoke, fontFamily: EPISIO_FONTS.ui },
  badgeEp: { fontSize: 12, fontFamily: EPISIO_FONTS.uiBold, color: EPISIO.paper },
  centerPlay: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(245,239,227,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  actionRail: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
    gap: 20,
    zIndex: 3,
  },
  actionItem: { alignItems: 'center', gap: 4 },
  actionCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCount: { fontSize: 10, fontFamily: EPISIO_FONTS.uiBold, color: EPISIO.paper },
  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    paddingHorizontal: 16,
    paddingTop: 70,
  },
  watchInfo: { marginBottom: 12 },
  watchTitle: {
    fontFamily: EPISIO_FONTS.display,
    fontSize: 17,
    color: EPISIO.paper,
  },
  watchSeries: {
    fontSize: 12,
    color: EPISIO.smoke,
    marginTop: 2,
    fontFamily: EPISIO_FONTS.ui,
  },
  scrub: {
    height: 3,
    backgroundColor: EPISIO.ringTrack,
    borderRadius: 2,
    marginBottom: 8,
    overflow: 'hidden',
  },
  scrubFill: { height: '100%', backgroundColor: EPISIO.ember, borderRadius: 2 },
  scrubTime: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  time: { fontSize: 10, color: EPISIO.smokeDim, fontFamily: EPISIO_FONTS.ui },
  upNext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: EPISIO.ink800,
    borderRadius: EPISIO_RADIUS.card,
    padding: 10,
    marginBottom: 10,
  },
  upNextThumb: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: EPISIO.ink700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upNextTitle: { fontSize: 12, color: EPISIO.paper, fontFamily: EPISIO_FONTS.uiBold },
  upNextSub: { fontSize: 10, color: EPISIO.smoke, fontFamily: EPISIO_FONTS.ui },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  swipeText: { fontSize: 10, color: EPISIO.smokeDim, fontFamily: EPISIO_FONTS.ui },
});

export default PlayerScreen;
