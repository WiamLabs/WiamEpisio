/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
/**
 * SeriesDetailScreen — drama series (html/series-detail.html).
 * Route: SeriesDetail { seriesId }
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, RefreshControl, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Share2, MoreHorizontal, Play } from 'lucide-react-native';
import {
  EPISIO, EPISIO_FONTS, EPISIO_RADIUS, placeholderPosterFor,
} from '../../constants/episioTheme';
import episodesApi from '../../api/episodes';
import resolveUrl from '../../utils/resolveUrl';
import FreeRing from '../../components/watch/FreeRing';
import EpisodeRow from '../../components/watch/EpisodeRow';

const SeriesDetailScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { seriesId } = route.params || {};
  const [series, setSeries] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [sRes, eRes] = await Promise.all([
        episodesApi.getSeries(seriesId),
        episodesApi.listEpisodes(seriesId),
      ]);
      setSeries(sRes?.series || null);
      setEpisodes(eRes?.episodes || []);
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Could not load series');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [seriesId]);

  useEffect(() => { load(); }, [load]);

  const openEpisode = (ep) => {
    navigation.navigate('Player', { seriesId, episodeId: ep.id });
  };

  if (loading) {
    return (
      <View style={[styles.page, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={EPISIO.ember} />
      </View>
    );
  }

  if (error || !series) {
    return (
      <View style={[styles.page, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.err}>{error || 'Series not found'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const uri = resolveUrl(series.poster_url || series.cover_url);
  const freeN = series.free_episode_count ?? 5;
  const total = series.total_episodes || episodes.length || 24;
  const pct = total > 0 ? Math.round((freeN / total) * 100) : 21;
  const first = episodes[0];

  return (
    <View style={styles.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={EPISIO.ember}
          />
        )}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
      >
        <View style={[styles.banner, { paddingTop: insets.top + 8 }]}>
          {uri ? (
            <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <Image source={placeholderPosterFor(series.id)} style={StyleSheet.absoluteFill} resizeMode="cover" />
          )}
          <LinearGradient
            colors={['rgba(20,17,12,0.2)', EPISIO.ink900]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0.3 }}
            end={{ x: 0.5, y: 1 }}
          />
          <View style={styles.bannerTop}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
              <ChevronLeft size={18} color={EPISIO.paper} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => Share.share({ message: series.title || 'Watch on WiamEpisio' })}
              >
                <Share2 size={16} color={EPISIO.paper} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn}>
                <MoreHorizontal size={16} color={EPISIO.paper} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.eyebrow}>
              {(series.genre || 'Drama')} · African originals
            </Text>
            <Text style={styles.title}>{series.title}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{new Date().getFullYear()}</Text>
              <Text style={styles.meta}>·</Text>
              <Text style={styles.meta}>{total} episodes</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.freeBanner}>
            <FreeRing pct={pct} size={44} label={`${freeN}/${total}`} />
            <Text style={styles.freeText}>
              <Text style={styles.freeBold}>Episodes 1–{freeN} are free. </Text>
              Unlock the rest with WiamCoins as you go, or get a Series Pass.
            </Text>
          </View>

          {series.description ? (
            <Text style={styles.synopsis} numberOfLines={synopsisExpanded ? 0 : 4}>
              {series.description}
              {!synopsisExpanded && series.description.length > 120 ? (
                <Text
                  style={styles.more}
                  onPress={() => setSynopsisExpanded(true)}
                >
                  {' '}More
                </Text>
              ) : null}
            </Text>
          ) : null}

          <View style={styles.epHead}>
            <Text style={styles.sectionTitle}>Episodes</Text>
            <Text style={styles.seeAll}>Season 1</Text>
          </View>

          {episodes.length === 0 ? (
            <Text style={styles.emptyEps}>No published episodes yet.</Text>
          ) : (
            episodes.map((ep) => (
              <EpisodeRow key={String(ep.id)} episode={ep} onPress={() => openEpisode(ep)} />
            ))
          )}
        </View>
      </ScrollView>

      {first ? (
        <View style={[styles.sticky, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={styles.stickyBtn}
            onPress={() => openEpisode(first)}
            activeOpacity={0.88}
          >
            <Play size={14} color={EPISIO.emberDeep} fill={EPISIO.emberDeep} />
            <Text style={styles.stickyText}>Watch episode 1</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: EPISIO.ink900 },
  center: { alignItems: 'center', justifyContent: 'center' },
  err: { color: EPISIO.coral, marginBottom: 12, fontFamily: EPISIO_FONTS.ui },
  link: { color: EPISIO.ember, fontFamily: EPISIO_FONTS.uiBold },
  banner: {
    height: 260,
    justifyContent: 'flex-end',
    padding: 16,
    backgroundColor: EPISIO.ink700,
  },
  bannerTop: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: { zIndex: 2 },
  eyebrow: {
    fontSize: 11,
    fontFamily: EPISIO_FONTS.uiSemi,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: EPISIO.smoke,
  },
  title: {
    fontFamily: EPISIO_FONTS.display,
    fontSize: 24,
    color: EPISIO.paper,
    marginTop: 4,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  meta: { fontSize: 12, color: EPISIO.smoke, fontFamily: EPISIO_FONTS.ui },
  body: { paddingHorizontal: 16, paddingTop: 8, gap: 20 },
  freeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: EPISIO.ink800,
    borderRadius: EPISIO_RADIUS.card,
    padding: 14,
  },
  freeText: { flex: 1, fontSize: 12, color: EPISIO.smoke, fontFamily: EPISIO_FONTS.ui, lineHeight: 18 },
  freeBold: { color: EPISIO.paper, fontFamily: EPISIO_FONTS.uiBold },
  synopsis: {
    fontSize: 13,
    lineHeight: 21,
    color: EPISIO.smoke,
    fontFamily: EPISIO_FONTS.ui,
  },
  more: { color: EPISIO.ember, fontFamily: EPISIO_FONTS.uiSemi },
  epHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: EPISIO_FONTS.uiSemi,
    color: EPISIO.paper,
  },
  seeAll: { fontSize: 12, color: EPISIO.smoke, fontFamily: EPISIO_FONTS.uiMedium },
  emptyEps: { color: EPISIO.smoke, fontFamily: EPISIO_FONTS.ui, paddingVertical: 20 },
  sticky: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: EPISIO.ink900,
  },
  stickyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: EPISIO.ember,
    paddingVertical: 14,
    borderRadius: EPISIO_RADIUS.pill,
  },
  stickyText: {
    fontFamily: EPISIO_FONTS.uiSemi,
    fontSize: 14,
    color: EPISIO.emberDeep,
  },
});

export default SeriesDetailScreen;
