/**
 * Shelves matching HTML:
 * - category → WiamEpisio-Category-Shelf.html (3-col + Popular/Fresh/A–Z/…)
 * - fresh → Live Now + Coming Soon (Fresh = New)
 * - rankings → Most Trending, Top Searched, Fresh Releases
 * - origin → WiamEpisio-Home-Origin-Shelf.html
 * - vip / anime → grid shelves
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';
import watchApi from '../../api/watch';
import PosterCard from '../../components/episio/PosterCard';
import resolveUrl from '../../utils/resolveUrl';
import { useEpisioGenres } from '../../hooks/useEpisioGenres';

const CAT_FILTERS = ['Popular', 'Fresh', 'A–Z', 'Completed', 'Free Only'];
const FRESH_TABS = ['Live Now', 'Coming Soon'];
const RANK_TABS = ['Most Trending', 'Top Searched', 'Fresh Releases'];

const { width: W } = Dimensions.get('window');
const COL3 = (W - 40 - 20) / 3;
const COL2 = (W - 40 - 12) / 2;

const ShelfScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { genres: GENRE_CHIPS } = useEpisioGenres();
  const mode = route.params?.mode || 'origin';
  const initialGenre = route.params?.genre || 'Drama';
  const titleParam = route.params?.title;
  const subParam = route.params?.sub; // 'coming' for Fresh

  const [genre, setGenre] = useState(initialGenre);
  const [catFilter, setCatFilter] = useState('Popular');
  const [freshTab, setFreshTab] = useState(subParam === 'coming' ? 'Coming Soon' : 'Live Now');
  const [rankTab, setRankTab] = useState('Most Trending');
  const [home, setHome] = useState(null);
  const [rankings, setRankings] = useState([]);
  const [shelfSeries, setShelfSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (soft = false) => {
    if (!soft) setLoading(true);
    setError(null);
    try {
      if (mode === 'rankings' || mode === 'fresh' || mode === 'category') {
        const [h, r] = await Promise.all([
          watchApi.home(),
          mode === 'rankings' ? watchApi.rankings('weekly').catch(() => ({ rankings: [] })) : Promise.resolve(null),
        ]);
        setHome(h);
        setRankings(r?.rankings || []);
      } else {
        const shelf = mode === 'origin' ? 'origin' : mode === 'vip' ? 'vip' : mode === 'anime' ? 'anime' : 'standard';
        const data = await watchApi.shelf(shelf);
        setShelfSeries(data?.series || []);
        if (mode === 'origin' || mode === 'vip') {
          const h = await watchApi.home().catch(() => null);
          setHome(h);
        }
      }
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Could not load shelf');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mode]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const categoryItems = useMemo(() => {
    const pool = [...(home?.popular || []), ...(home?.fresh || [])];
    const seen = new Set();
    let list = [];
    for (const s of pool) {
      if (!s?.id || seen.has(s.id)) continue;
      seen.add(s.id);
      const g = (s.genre || '').toLowerCase();
      const matchGenre = !genre
        || genre === 'All'
        || g.includes(genre.toLowerCase())
        || (genre === 'African Originals' && (s.is_wiam_origin || g.includes('african')));
      if (matchGenre) list.push(s);
    }
    if (catFilter === 'Fresh') {
      const freshIds = new Set((home?.fresh || []).map((x) => x.id));
      list = list.filter((s) => freshIds.has(s.id));
    } else if (catFilter === 'A–Z') {
      list = [...list].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (catFilter === 'Completed') {
      list = list.filter((s) => s.status === 'complete' || s.is_series_complete);
    } else if (catFilter === 'Free Only') {
      list = list.filter((s) => (s.free_episode_count || 0) > 0);
    } else {
      // Popular — keep ranking order from popular first
      list = [...list].sort((a, b) => (b.ranking_score || 0) - (a.ranking_score || 0));
    }
    return list;
  }, [home, genre, catFilter]);

  const freshLive = home?.fresh || [];
  const freshComing = home?.coming_soon || [];
  const topSearched = home?.top_searched || home?.popular || [];
  const trending = rankings.length ? rankings : (home?.popular || []);

  const heading = titleParam
    || (mode === 'fresh' ? 'Fresh' : mode === 'rankings' ? 'Rankings' : mode === 'category' ? genre : titleParam)
    || mode;

  const openSeries = (id) => navigation.navigate('SeriesDetail', { seriesId: id });

  const renderGridItem = (item, index, colW, height = 154) => (
    <View style={{ width: colW, marginBottom: 10 }}>
      <PosterCard
        title={item.title}
        tag={null}
        posterUrl={item.poster_url || item.cover_url}
        badge={index === 0 ? 'HOT' : (item.status === 'ongoing' && index < 3 ? 'NEW' : null)}
        views={item.views ? String(item.views) : null}
        width={colW}
        height={height}
        onPress={() => openSeries(item.id)}
      />
    </View>
  );

  /* ── Category (HTML Category-Shelf) ── */
  if (mode === 'category') {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 2 }]}>
        <View style={styles.topbar}>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
              <ChevronLeft size={15} color="#fff" />
            </TouchableOpacity>
            <View>
              <Text style={styles.h1}>{genre}</Text>
              <Text style={styles.subCount}>{categoryItems.length} series</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {GENRE_CHIPS.map((g) => (
              <TouchableOpacity
                key={g}
                onPress={() => setGenre(g)}
                style={[styles.filterChip, genre === g && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, genre === g && styles.filterTextActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterRow, { marginTop: 8 }]}>
            {CAT_FILTERS.map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setCatFilter(f)}
                style={[styles.filterChip, catFilter === f && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, catFilter === f && styles.filterTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
          <FlatList
            data={categoryItems}
            keyExtractor={(item) => String(item.id)}
            numColumns={3}
            columnWrapperStyle={{ gap: 10, paddingHorizontal: 20 }}
            contentContainerStyle={{ paddingBottom: 40 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={COLORS.gold} />
            }
            ListHeaderComponent={
              <Text style={styles.countRow}>
                Showing <Text style={{ color: '#fff', fontFamily: FONTS.bold }}>{categoryItems.length}</Text>
                {' '}series, sorted by {catFilter.toLowerCase()}
              </Text>
            }
            ListEmptyComponent={<Text style={styles.empty}>No series in this category yet.</Text>}
            renderItem={({ item, index }) => renderGridItem(item, index, COL3, COL3 * 1.5)}
          />
        )}
      </View>
    );
  }

  /* ── Fresh = New: Live Now | Coming Soon ── */
  if (mode === 'fresh') {
    const list = freshTab === 'Live Now' ? freshLive : freshComing;
    return (
      <View style={[styles.root, { paddingTop: insets.top + 2 }]}>
        <View style={styles.topbar}>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
              <ChevronLeft size={15} color="#fff" />
            </TouchableOpacity>
            <View>
              <Text style={styles.h1}>Fresh</Text>
              <Text style={styles.subCount}>New · Live & Coming Soon</Text>
            </View>
          </View>
          <View style={styles.segment}>
            {FRESH_TABS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.segmentBtn, freshTab === t && styles.segmentBtnActive]}
                onPress={() => setFreshTab(t)}
              >
                <Text style={[styles.segmentText, freshTab === t && styles.segmentTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
          <FlatList
            data={list}
            keyExtractor={(item) => String(item.id)}
            numColumns={3}
            columnWrapperStyle={{ gap: 10, paddingHorizontal: 20 }}
            contentContainerStyle={{ paddingBottom: 40, paddingTop: 8 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={COLORS.gold} />
            }
            ListEmptyComponent={
              <Text style={styles.empty}>
                {freshTab === 'Live Now' ? 'No new live series yet.' : 'Nothing scheduled yet.'}
              </Text>
            }
            renderItem={({ item, index }) => renderGridItem(item, index, COL3, COL3 * 1.5)}
          />
        )}
      </View>
    );
  }

  /* ── Rankings: top press buttons → one grid at a time ── */
  if (mode === 'rankings') {
    const rankList =
      rankTab === 'Top Searched' ? topSearched
        : rankTab === 'Fresh Releases' ? freshLive
          : trending;
    return (
      <View style={[styles.root, { paddingTop: insets.top + 2 }]}>
        <View style={styles.topbar}>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
              <ChevronLeft size={15} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.h1}>Rankings</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rankBtnRow}
          >
            {RANK_TABS.map((t) => {
              const active = rankTab === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.rankBtn, active && styles.rankBtnActive]}
                  onPress={() => setRankTab(t)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.rankBtnText, active && styles.rankBtnTextActive]}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
        {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
          <FlatList
            data={rankList}
            keyExtractor={(item, i) => String(item.id || i)}
            numColumns={3}
            columnWrapperStyle={{ gap: 10, paddingHorizontal: 20 }}
            contentContainerStyle={{ paddingBottom: 40, paddingTop: 4 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={COLORS.gold} />
            }
            ListEmptyComponent={
              <Text style={styles.empty}>No rankings yet — publish series to fill this.</Text>
            }
            ListFooterComponent={error ? <Text style={styles.error}>{error}</Text> : null}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={{ width: COL3, marginBottom: 12 }}
                onPress={() => openSeries(item.id)}
                activeOpacity={0.85}
              >
                <View style={[styles.trendPoster, { width: COL3, height: COL3 * 1.5 }]}>
                  {resolveUrl(item.poster_url || item.cover_url) ? (
                    <Image
                      source={{ uri: resolveUrl(item.poster_url || item.cover_url) }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />
                  ) : (
                    <LinearGradient colors={[COLORS.navyCard, '#0d0d24']} style={StyleSheet.absoluteFill} />
                  )}
                  <View style={[
                    styles.rankBadge,
                    { backgroundColor: index === 0 ? '#F5A623' : index === 1 ? '#22C55E' : index === 2 ? '#3B82F6' : '#3a3a5a' },
                  ]}
                  >
                    <Text style={styles.rankText}>{item.rank_position || index + 1}</Text>
                  </View>
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.cardMeta} numberOfLines={1}>{item.genre || 'Drama'}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  /* ── Origin / VIP / Anime ── */
  const isOrigin = mode === 'origin';
  return (
    <View style={[styles.root, { paddingTop: insets.top + 2 }]}>
      <View style={styles.topbar}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <ChevronLeft size={15} color="#fff" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            {isOrigin ? <Sparkles size={17} color={COLORS.gold} /> : null}
            <Text style={styles.h1}>{heading}</Text>
          </View>
        </View>
      </View>
      {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={shelfSeries}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 20 }}
          contentContainerStyle={{ gap: 12, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={COLORS.gold} />
          }
          ListHeaderComponent={isOrigin ? (
            <LinearGradient colors={['#241a08', '#12122a']} style={styles.explainer}>
              <Text style={styles.originBadge}>EXCLUSIVE</Text>
              <Text style={styles.explainerTitle}>Made only for WiamEpisio</Text>
              <Text style={styles.explainerBody}>
                {"Origin titles are commissioned or specially licensed — you won't find these anywhere else."}
              </Text>
            </LinearGradient>
          ) : null}
          ListEmptyComponent={<Text style={styles.empty}>Nothing here yet.</Text>}
          renderItem={({ item, index }) => (
            <View style={{ width: COL2, marginBottom: 8 }}>
              <TouchableOpacity onPress={() => openSeries(item.id)} activeOpacity={0.85}>
                <View style={[styles.originArt, { width: COL2, height: COL2 * 1.5 }]}>
                  {resolveUrl(item.poster_url || item.cover_url) ? (
                    <Image
                      source={{ uri: resolveUrl(item.poster_url || item.cover_url) }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />
                  ) : null}
                  {isOrigin ? (
                    <View style={styles.originCardBadge}>
                      <Text style={styles.originCardBadgeText}>ORIGIN</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.cardMeta} numberOfLines={1}>{item.genre || 'Drama'}</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  topbar: { paddingHorizontal: 20, paddingBottom: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  h1: { fontSize: 19, fontFamily: FONTS.extraBold, color: '#fff' },
  subCount: { fontSize: 11, color: COLORS.textFaint, fontFamily: FONTS.semi, marginTop: 1 },
  filterRow: { gap: 8 },
  filterChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
  },
  filterChipActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  filterText: { fontSize: 12, fontFamily: FONTS.semi, color: '#B8B8CC' },
  filterTextActive: { color: COLORS.navy },
  countRow: { fontSize: 11, color: COLORS.textFaint, marginHorizontal: 20, marginBottom: 12, marginTop: 4 },
  segment: {
    flexDirection: 'row',
    backgroundColor: COLORS.navyCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    padding: 4,
  },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: COLORS.gold },
  segmentText: { fontSize: 13, fontFamily: FONTS.semi, color: COLORS.textFaint },
  segmentTextActive: { color: COLORS.navy, fontFamily: FONTS.bold },
  rankBtnRow: { gap: 8, paddingRight: 8 },
  rankBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
  },
  rankBtnActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  rankBtnText: { fontSize: 12, fontFamily: FONTS.semi, color: '#B8B8CC' },
  rankBtnTextActive: { color: COLORS.navy, fontFamily: FONTS.bold },
  trendPoster: { borderRadius: 12, overflow: 'hidden', backgroundColor: COLORS.navyCard, marginBottom: 6 },
  rankBadge: {
    position: 'absolute', top: 0, left: 0, width: 26, height: 26,
    borderTopLeftRadius: 8, borderBottomRightRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  rankText: { fontSize: 13, fontFamily: FONTS.extraBold, color: '#fff' },
  explainer: {
    marginHorizontal: 20, marginBottom: 20, borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: 'rgba(212,160,23,0.3)',
  },
  originBadge: {
    alignSelf: 'flex-start', fontSize: 9.5, fontFamily: FONTS.extraBold,
    color: COLORS.navy, backgroundColor: COLORS.gold, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 6, marginBottom: 10, overflow: 'hidden', letterSpacing: 0.4,
  },
  explainerTitle: { fontSize: 16, fontFamily: FONTS.extraBold, color: '#fff', marginBottom: 6 },
  explainerBody: { fontSize: 11.5, color: '#D9C89A', lineHeight: 18, fontFamily: FONTS.regular },
  originArt: { borderRadius: 14, overflow: 'hidden', backgroundColor: COLORS.navySoft },
  originCardBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: COLORS.gold, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5,
  },
  originCardBadgeText: { fontSize: 8, fontFamily: FONTS.extraBold, color: COLORS.navy },
  cardTitle: { fontSize: 12, fontFamily: FONTS.bold, color: '#fff', marginTop: 8 },
  cardMeta: { fontSize: 10, color: COLORS.textDim, fontFamily: FONTS.regular, marginTop: 2 },
  empty: { textAlign: 'center', color: COLORS.textFaint, marginTop: 40, fontFamily: FONTS.medium, paddingHorizontal: 24 },
  error: { color: '#EF4444', fontFamily: FONTS.medium, marginTop: 12, paddingHorizontal: 20 },
});

export default ShelfScreen;
