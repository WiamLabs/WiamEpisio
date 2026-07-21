/**
 * Layout source of truth: WiamEpisio-Series-Detail-Sheet.html
 * Data: live /api/v1/series/:id + episodes + watch/home recs
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Dimensions, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import {
  ChevronLeft, Share2, Play, Lock, Star, ChevronRight, Bookmark, Heart,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';
import episodesApi from '../../api/episodes';
import watchApi from '../../api/watch';
import studioEpisioApi from '../../api/studioEpisio';
import useAuthStore from '../../store/useAuthStore';
import resolveUrl from '../../utils/resolveUrl';
import { assertGuestCanWatchSeries } from '../../utils/guestSeriesGate';

const { width: W } = Dimensions.get('window');
const HERO_H = 280;
const REC_W = (W - 40 - 20) / 3;

const SeriesDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation();
  const seriesId = route.params?.seriesId;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [tab, setTab] = useState('Synopsis');
  const [series, setSeries] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [favorited, setFavorited] = useState(false);
  const [reminded, setReminded] = useState(false);
  const [avgRating, setAvgRating] = useState(null);
  const [ratingCount, setRatingCount] = useState(null);

  const load = useCallback(async () => {
    if (!seriesId) return;
    setLoading(true);
    setError(null);
    try {
      const [detail, eps, home, rem] = await Promise.all([
        episodesApi.getSeries(seriesId),
        episodesApi.listEpisodes(seriesId),
        watchApi.home().catch(() => null),
        isAuthenticated
          ? studioEpisioApi.listReminders().catch(() => ({ reminders: [] }))
          : Promise.resolve({ reminders: [] }),
      ]);
      const s = detail?.series || detail;
      setSeries(s);
      setFavorited(!!(s?.is_favorited || s?.favorited));
      setAvgRating(s?.avg_rating ?? s?.rating ?? null);
      setRatingCount(s?.rating_count ?? null);
      setEpisodes(eps?.episodes || eps?.items || (Array.isArray(eps) ? eps : []));
      const remList = rem?.reminders || rem?.items || [];
      setReminded(remList.some((r) => String(r.series_id || r.content_id || r.id) === String(seriesId)));
      const pop = (home?.popular || []).filter((x) => x.id !== seriesId).slice(0, 6);
      setRecs(pop);
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Failed to load series');
    } finally {
      setLoading(false);
    }
  }, [seriesId, isAuthenticated]);

  React.useEffect(() => { load(); }, [load]);

  const requireAuth = (fn) => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    fn();
  };

  const playEpisode = async (ep) => {
    if (!ep) return;
    const gate = await assertGuestCanWatchSeries(seriesId, isAuthenticated);
    if (!gate.allowed) {
      navigation.navigate('LoginRequiredSheet', {
        title: 'Register to watch more',
        message: 'As a guest you can finish one series. Sign in free to watch a different series.',
      });
      return;
    }
    if (ep.locked) {
      navigation.navigate('UnlockTakeover', {
        episodeId: ep.id,
        seriesId,
        unlockPrice: ep.unlock_price_coins || series?.unlock_price_coins || 10,
        episodeNumber: ep.episode_number,
        seriesTitle: series?.title,
        synopsis: ep.synopsis || series?.description,
      });
      return;
    }
    navigation.navigate('Player', {
      episodeId: ep.id,
      seriesId,
      seriesTitle: series?.title,
      synopsis: series?.description,
      episodeNumber: ep.episode_number,
    });
  };

  const openTrailer = () => {
    navigation.navigate('TrailerPlayer', { seriesId, title: series?.title });
  };

  const onShare = () => {
    navigation.navigate('ShareSheet', {
      title: series?.title,
      url: `https://episio.wiamlabs.com/series/${seriesId}`,
      seriesId,
    });
  };

  const onRate = () => requireAuth(() => {
    navigation.navigate('RateSeries', {
      seriesId,
      title: series?.title,
      onRated: (avg, count) => {
        if (avg != null) setAvgRating(avg);
        if (count != null) setRatingCount(count);
      },
    });
  });

  const onFavorite = () => requireAuth(async () => {
    try {
      if (favorited) {
        await studioEpisioApi.unremind(seriesId);
        setFavorited(false);
        Alert.alert('My List', 'Removed from reminders.');
      } else {
        await studioEpisioApi.remind(seriesId);
        setFavorited(true);
        Alert.alert('My List', 'Saved — reminder set.');
      }
    } catch (e) {
      Alert.alert('My List', e?.message || 'Could not update');
    }
  });

  const onMyList = () => requireAuth(async () => {
    try {
      if (reminded) {
        await studioEpisioApi.unremind(seriesId);
        setReminded(false);
        Alert.alert('My List', 'Removed from reminders.');
      } else {
        await studioEpisioApi.remind(seriesId);
        setReminded(true);
        Alert.alert('My List', 'Saved — reminder set.');
      }
    } catch (e) {
      Alert.alert('My List', e?.message || 'Could not update list');
    }
  });

  const firstPlayable = episodes.find((e) => !e.locked) || episodes[0];
  const poster = resolveUrl(series?.poster_url || series?.cover_url || series?.trailer_poster_url);
  const tags = (series?.genre || '')
    .split(/[,·|/]/)
    .map((t) => t.trim())
    .filter(Boolean);
  const views = series?.view_count || series?.views;
  const rating = avgRating;

  if (loading) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.gold} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity onPress={load}><Text style={styles.retry}>Retry</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* HTML: .trailer-hero */}
      <View style={[styles.trailerHero, { height: HERO_H + insets.top }]}>
        {poster ? (
          <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : null}
        <LinearGradient
          colors={['transparent', 'rgba(8,8,26,0.15)', COLORS.navy]}
          locations={[0.22, 0.55, 0.98]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.trailerTopbar, { top: insets.top + 16 }]}>
          <TouchableOpacity style={styles.thBtn} onPress={() => navigation.goBack()}>
            <ChevronLeft size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.thBtn} onPress={onShare}>
            <Share2 size={15} color="#fff" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.trailerPlay} onPress={openTrailer} activeOpacity={0.9}>
          <Play size={26} color={COLORS.navy} fill={COLORS.navy} />
        </TouchableOpacity>
        <Text style={styles.trailerLabel}>TRAILER</Text>
        <Text style={styles.trailerQuality}>HD</Text>
      </View>

      <ScrollView
        style={styles.sheetBody}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* HTML: .info-block */}
        <View style={styles.infoBlock}>
          <Text style={styles.headerTitle}>{series?.title}</Text>
          {views != null ? (
            <Text style={styles.headerViews}>
              {Number(views) >= 1000000
                ? `${(Number(views) / 1000000).toFixed(1)}M Views`
                : Number(views) >= 1000
                  ? `${(Number(views) / 1000).toFixed(1)}K Views`
                  : `${views} Views`}
            </Text>
          ) : (
            <Text style={styles.headerViews}>
              {[
                series?.total_episodes ? `${series.total_episodes} Episodes` : null,
                series?.genre,
              ].filter(Boolean).join(' · ') || ' '}
            </Text>
          )}
          <View style={styles.headerRate}>
            <Star size={12} color={COLORS.gold} fill={COLORS.gold} />
            <Text style={styles.rateBold}>{rating != null ? Number(rating).toFixed(1) : '—'}</Text>
            {ratingCount != null ? (
              <Text style={styles.rateMuted}>({Number(ratingCount) >= 1000 ? `${(Number(ratingCount) / 1000).toFixed(1)}K` : ratingCount})</Text>
            ) : null}
            <TouchableOpacity onPress={onRate} hitSlop={8}>
              <Text style={styles.rateLink}>Rate ›</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionChip} onPress={onFavorite}>
              <Heart size={14} color={favorited ? COLORS.gold : '#C9C9DE'} fill={favorited ? COLORS.gold : 'transparent'} />
              <Text style={styles.actionChipText}>{favorited ? 'Liked' : 'Like'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionChip} onPress={onMyList}>
              <Bookmark size={14} color={reminded ? COLORS.gold : '#C9C9DE'} fill={reminded ? COLORS.gold : 'transparent'} />
              <Text style={styles.actionChipText}>{reminded ? 'In List' : 'My List'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionChip} onPress={onShare}>
              <Share2 size={14} color="#C9C9DE" />
              <Text style={styles.actionChipText}>Share</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.freeNote}>
            Episodes 1–5 are free. Later episodes unlock with coins or VIP.
          </Text>
        </View>

        {/* HTML: .sheet-tabs */}
        <View style={styles.sheetTabs}>
          {['Synopsis', 'Episodes'].map((t) => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} style={styles.sheetTabBtn}>
              <Text style={[styles.sheetTab, tab === t && styles.sheetTabActive]}>{t}</Text>
              {tab === t ? <View style={styles.sheetTabLine} /> : null}
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'Synopsis' ? (
          <>
            <Text style={styles.synopsisText}>
              {series?.description || 'No synopsis yet.'}
            </Text>
            <View style={styles.tagRow}>
              {tags.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={styles.tagChip}
                  onPress={() => navigation.navigate('Shelf', { mode: 'category', genre: t, title: t })}
                >
                  <ChevronRight size={11} color={COLORS.gold} />
                  <Text style={styles.tagChipText}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {recs.length ? (
              <>
                <View style={styles.dividerLabel}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>More Like This</Text>
                  <View style={styles.dividerLine} />
                </View>
                <View style={styles.recsGrid}>
                  {recs.slice(0, 6).map((s) => {
                    const uri = resolveUrl(s.poster_url || s.cover_url);
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.recItem, { width: REC_W }]}
                        onPress={() => navigation.replace('SeriesDetail', { seriesId: s.id })}
                      >
                        <View style={styles.recPoster}>
                          {uri ? (
                            <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                          ) : null}
                        </View>
                        <Text style={styles.recTitle} numberOfLines={2}>{s.title}</Text>
                        <Text style={styles.recTag} numberOfLines={1}>{s.genre || 'Drama'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : null}
          </>
        ) : (
          <View style={styles.epList}>
            {episodes.map((ep) => (
              <TouchableOpacity
                key={ep.id}
                style={styles.epRow}
                onPress={() => playEpisode(ep)}
              >
                <View style={styles.epNum}>
                  <Text style={styles.epNumText}>{ep.episode_number}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.epTitle} numberOfLines={1}>
                    {ep.title || `Episode ${ep.episode_number}`}
                  </Text>
                  <Text style={styles.epSub} numberOfLines={1}>
                    {ep.is_free_tier
                      ? 'Free'
                      : `${ep.unlock_price_coins || series?.unlock_price_coins || 10} coins`}
                  </Text>
                </View>
                {ep.locked ? (
                  <Lock size={16} color={COLORS.textFaint} />
                ) : (
                  <Play size={16} color={COLORS.gold} fill={COLORS.gold} />
                )}
              </TouchableOpacity>
            ))}
            {!episodes.length ? (
              <Text style={styles.emptyEps}>Episodes coming soon.</Text>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Sticky play CTA under HTML sheet */}
      <View style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity style={styles.playCta} onPress={() => playEpisode(firstPlayable)} disabled={!firstPlayable}>
          <Play size={18} color={COLORS.navy} fill={COLORS.navy} />
          <Text style={styles.playCtaText}>
            {firstPlayable ? `Play EP ${firstPlayable.episode_number}` : 'No episodes'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  center: { alignItems: 'center', justifyContent: 'center' },
  error: { color: COLORS.error, fontFamily: FONTS.medium, marginBottom: 12 },
  retry: { color: COLORS.gold, fontFamily: FONTS.semi },

  trailerHero: {
    width: '100%',
    backgroundColor: '#0d0d24',
    overflow: 'hidden',
  },
  trailerTopbar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  thBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(8,8,26,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailerPlay: {
    position: 'absolute',
    top: '48%',
    left: '50%',
    marginLeft: -30,
    marginTop: -30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    shadowColor: COLORS.gold,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  trailerLabel: {
    position: 'absolute',
    bottom: 14,
    left: 16,
    fontSize: 10,
    fontFamily: FONTS.bold,
    color: COLORS.gold,
    backgroundColor: 'rgba(8,8,26,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    letterSpacing: 0.5,
    zIndex: 2,
    overflow: 'hidden',
  },
  trailerQuality: {
    position: 'absolute',
    bottom: 14,
    right: 16,
    fontSize: 9.5,
    fontFamily: FONTS.bold,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    zIndex: 2,
    overflow: 'hidden',
  },

  sheetBody: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  infoBlock: { marginBottom: 16 },
  headerTitle: {
    fontSize: 17,
    fontFamily: FONTS.extraBold,
    color: '#fff',
    marginBottom: 6,
    lineHeight: 22,
  },
  headerViews: {
    fontSize: 11,
    color: COLORS.textFaint,
    fontFamily: FONTS.regular,
    marginBottom: 4,
  },
  headerRate: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rateBold: { color: '#fff', fontFamily: FONTS.bold, fontSize: 12 },
  rateMuted: { color: COLORS.textFaint, fontFamily: FONTS.regular, fontSize: 12 },
  rateLink: { color: COLORS.gold, fontFamily: FONTS.semi, fontSize: 12, marginLeft: 4 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  actionChipText: { fontSize: 11.5, color: '#C9C9DE', fontFamily: FONTS.semi },
  freeNote: {
    marginTop: 12, fontSize: 11, color: COLORS.textDim, fontFamily: FONTS.regular, lineHeight: 16,
  },

  sheetTabs: {
    flexDirection: 'row',
    gap: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.navyLine,
    marginBottom: 16,
  },
  sheetTabBtn: { paddingBottom: 10 },
  sheetTab: {
    fontSize: 13.5,
    fontFamily: FONTS.semi,
    color: COLORS.textFaint,
  },
  sheetTabActive: { color: '#fff' },
  sheetTabLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: COLORS.gold,
  },

  synopsisText: {
    fontSize: 12.5,
    color: '#B8B8CC',
    lineHeight: 21,
    fontFamily: FONTS.regular,
    marginBottom: 16,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tagChipText: { fontSize: 11.5, color: '#D3D3E2', fontFamily: FONTS.medium },

  dividerLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.navyLine },
  dividerText: { fontSize: 12, color: COLORS.textFaint, fontFamily: FONTS.regular },

  recsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  recItem: {},
  recPoster: {
    aspectRatio: 2 / 3,
    borderRadius: 11,
    backgroundColor: COLORS.navyCard,
    overflow: 'hidden',
    marginBottom: 6,
  },
  recTitle: { fontSize: 11, fontFamily: FONTS.semi, color: '#fff', lineHeight: 14 },
  recTag: { fontSize: 9.5, color: COLORS.textFaint, marginTop: 2, fontFamily: FONTS.regular },

  epList: { gap: 0 },
  epRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.navyLine,
  },
  epNum: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.navyCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  epNumText: { color: COLORS.gold, fontFamily: FONTS.bold, fontSize: 13 },
  epTitle: { color: '#fff', fontFamily: FONTS.semi, fontSize: 13.5 },
  epSub: { color: COLORS.textFaint, fontFamily: FONTS.regular, fontSize: 11, marginTop: 2 },
  emptyEps: { color: COLORS.textFaint, fontFamily: FONTS.medium, paddingVertical: 24, textAlign: 'center' },

  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: COLORS.navy,
    borderTopWidth: 1,
    borderTopColor: COLORS.navyLine,
  },
  playCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.gold,
    borderRadius: 16,
    paddingVertical: 15,
  },
  playCtaText: { fontFamily: FONTS.bold, color: COLORS.navy, fontSize: 14.5 },
});

export default SeriesDetailScreen;
