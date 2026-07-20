/**
 * Layout source of truth: WiamEpisio-Home.html
 * Featured = up to 6 muted autoplay trailers (no placeholder when empty).
 * Genre chips + Fresh / Rankings / Categories open real shelves.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Image, Pressable, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Search, Clock, Coins, Bell } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';
import LogoBadge from '../../components/episio/LogoBadge';
import PosterCard from '../../components/episio/PosterCard';
import FeaturedTrailerCarousel, { buildFeaturedList } from '../../components/episio/FeaturedTrailerCarousel';
import watchApi from '../../api/watch';
import episodesApi from '../../api/episodes';
import studioEpisioApi from '../../api/studioEpisio';
import coinsApi from '../../api/coins';
import useAuthStore from '../../store/useAuthStore';
import resolveUrl from '../../utils/resolveUrl';
import { useEpisioGenres } from '../../hooks/useEpisioGenres';

const TABS = ['Popular', 'Fresh', 'Rankings', 'Categories', 'Wiam Origin', 'Anime', 'VIP'];

function EmptyPoster({ width = 108, height = 154, title, tag, noMargin }) {
  return (
    <View style={{ width, marginRight: noMargin ? 0 : 11 }}>
      <LinearGradient
        colors={[COLORS.navySoft, '#0d0d24']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width, height, borderRadius: 14 }}
      />
      {title ? <Text style={styles.posterTitle} numberOfLines={2}>{title}</Text> : null}
      {tag ? <Text style={styles.posterTag} numberOfLines={1}>{tag}</Text> : null}
    </View>
  );
}

function SectionHead({ title, onSeeAll }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onSeeAll ? (
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { genres: GENRES } = useEpisioGenres({ includeAll: true });
  const [tab, setTab] = useState('Popular');
  const [genre, setGenre] = useState('All');
  const [data, setData] = useState(null);
  const [continueList, setContinueList] = useState([]);
  const [balance, setBalance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [home, cw, bal] = await Promise.all([
        watchApi.home(),
        isAuthenticated ? episodesApi.continueWatching().catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
        isAuthenticated ? coinsApi.getBalance().catch(() => ({ balance: 0 })) : Promise.resolve({ balance: 0 }),
      ]);
      setData(home);
      setContinueList(cw?.items || cw?.continue_watching || []);
      setBalance(bal?.balance ?? bal?.coins ?? 0);
    } catch {
      setData((d) => d || {
        popular: [], fresh: [], coming_soon: [], top_searched: [],
        shelves: { origin: [], anime: [], vip: [] }, featured_trailers: {},
      });
    } finally {
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const featured = useMemo(() => buildFeaturedList(data), [data]);

  const openSeries = (id) => {
    if (!id) return;
    navigation.navigate('SeriesDetail', { seriesId: id });
  };

  const openFeatured = (item) => {
    if (!item?.id) return;
    navigation.navigate('TrailerPlayer', {
      seriesId: item.id,
      title: item.title,
      muted: false,
    });
  };

  const onTab = (c) => {
    if (c === 'Fresh') {
      navigation.navigate('Shelf', { mode: 'fresh', title: 'Fresh' });
      return;
    }
    if (c === 'Rankings') {
      navigation.navigate('Shelf', { mode: 'rankings', title: 'Rankings' });
      return;
    }
    if (c === 'Categories') {
      navigation.navigate('Shelf', { mode: 'category', genre: 'Drama', title: 'Drama' });
      return;
    }
    if (c === 'Wiam Origin') {
      navigation.navigate('Shelf', { mode: 'origin', title: 'Wiam Origin' });
      return;
    }
    if (c === 'Anime') {
      navigation.navigate('Shelf', { mode: 'anime', title: 'Anime' });
      return;
    }
    if (c === 'VIP') {
      navigation.navigate('Shelf', { mode: 'vip', title: 'VIP' });
      return;
    }
    setTab(c);
  };

  const onGenre = (g) => {
    setGenre(g);
    if (g === 'All') return;
    navigation.navigate('Shelf', {
      mode: 'category',
      genre: g,
      title: g,
    });
  };

  const trending = (() => {
    let list = tab === 'Fresh' ? (data?.fresh || []) : (data?.popular || []);
    if (genre === 'All') return list;
    const g = genre.toLowerCase();
    return list.filter((s) => (s.genre || '').toLowerCase().includes(g));
  })();

  const origin = data?.shelves?.origin || [];
  const comingSoon = data?.coming_soon || [];

  const remind = async (seriesId) => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    if (!seriesId) return;
    try {
      await studioEpisioApi.remind(seriesId);
      Alert.alert('My List', 'Reminder set — we will notify you.');
    } catch (e) {
      Alert.alert('My List', e?.message || 'Could not set reminder');
    }
  };

  const searchHint = featured[0]?.title || 'Search series';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topFixed}>
        <View style={styles.brandRow}>
          <View style={styles.brand}>
            <LogoBadge size={30} />
            <Text style={styles.brandName}>
              Wiam<Text style={{ color: COLORS.gold }}>Episio</Text>
            </Text>
          </View>
          <View style={styles.headerIcons}>
            {!isAuthenticated ? (
              <TouchableOpacity style={styles.signInPill} onPress={() => navigation.navigate('Login')}>
                <Text style={styles.signInText}>Sign In</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.coinPill}
                  onPress={() => navigation.navigate('BuyCoins')}
                >
                  <Coins size={13} color={COLORS.navy} fill={COLORS.navy} />
                  <Text style={styles.coinPillText}>{balance}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')}>
                  <Bell size={16} color="#C9C9DE" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <TouchableOpacity style={styles.searchBar} onPress={() => navigation.navigate('Search')} activeOpacity={0.85}>
          <Search size={14} color={COLORS.textFaint} />
          <Text style={styles.searchPlaceholder} numberOfLines={1}>{searchHint}</Text>
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {TABS.map((c) => {
            const active = tab === c;
            const originTab = c === 'Wiam Origin';
            return (
              <TouchableOpacity key={c} onPress={() => onTab(c)} style={styles.tabBtn}>
                <Text
                  style={[
                    styles.tab,
                    active && styles.tabActive,
                    originTab && { color: COLORS.gold },
                  ]}
                >
                  {c}
                </Text>
                {active ? <View style={styles.tabUnderline} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={COLORS.gold}
          />
        }
      >
        {/* Featured: only when founder/team (or fill sources) have items — never a fake placeholder */}
        <FeaturedTrailerCarousel items={featured} onPressItem={openFeatured} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genreRow}>
          {GENRES.map((g) => {
            const active = genre === g;
            return (
              <TouchableOpacity
                key={g}
                onPress={() => onGenre(g)}
                style={[styles.genreChip, active && styles.genreChipActive]}
              >
                <Text style={[styles.genreText, active && styles.genreTextActive]}>{g}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {isAuthenticated ? (
          <View style={styles.quickRow}>
            <TouchableOpacity
              style={styles.quickChip}
              onPress={() => navigation.navigate('DailyRewards')}
              activeOpacity={0.85}
            >
              <Text style={styles.quickChipText}>Daily Rewards</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickChip}
              onPress={() => navigation.navigate('MembershipOfferModal')}
              activeOpacity={0.85}
            >
              <Text style={styles.quickChipText}>VIP Offer</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <SectionHead title="Continue Watching" onSeeAll={() => navigation.navigate('MyList')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.posterRow}>
          {continueList.length ? continueList.map((item) => (
            <PosterCard
              key={`cw-${item.episode_id || item.id}`}
              title={item.series_title || item.title}
              tag={item.episode_number ? `EP ${item.episode_number}${item.total_episodes ? ` of ${item.total_episodes}` : ''}` : null}
              posterUrl={item.poster_url || item.cover_url}
              onPress={() => {
                if (!isAuthenticated) {
                  navigation.navigate('Login');
                  return;
                }
                if (item.episode_id) {
                  navigation.navigate('Player', {
                    episodeId: item.episode_id,
                    seriesId: item.content_id || item.series_id,
                  });
                } else {
                  openSeries(item.content_id || item.series_id || item.id);
                }
              }}
            />
          )) : (
            <>
              <EmptyPoster title="Start watching" tag="Your history" />
              <EmptyPoster title="Pick a series" tag="Free first episodes" />
            </>
          )}
        </ScrollView>

        <SectionHead
          title="Trending Now"
          onSeeAll={() => navigation.navigate('Shelf', { mode: 'rankings', title: 'Rankings' })}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.posterRow}>
          {trending.length ? trending.map((s, i) => (
            <PosterCard
              key={`t-${s.id}`}
              title={s.title}
              tag={s.genre || 'Drama'}
              posterUrl={s.poster_url || s.cover_url}
              badge={i === 0 ? 'HOT' : (i === 1 ? 'NEW' : null)}
              onPress={() => openSeries(s.id)}
            />
          )) : (
            <>
              <EmptyPoster title="Coming to catalog" tag="Drama" />
              <EmptyPoster title="Creators uploading" tag="Soon" />
              <EmptyPoster title="Stay tuned" tag="WiamEpisio" />
            </>
          )}
        </ScrollView>

        <SectionHead
          title="Wiam Origin"
          onSeeAll={() => navigation.navigate('Shelf', { mode: 'origin', title: 'Wiam Origin' })}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.posterRow}>
          {origin.length ? origin.map((s) => (
            <PosterCard
              key={`o-${s.id}`}
              title={s.title}
              tag="Wiam Origin"
              posterUrl={s.poster_url || s.cover_url}
              badge="NEW"
              onPress={() => openSeries(s.id)}
            />
          )) : (
            <>
              <EmptyPoster title="Origin originals" tag="Wiam Origin" />
              <EmptyPoster title="African stories" tag="Wiam Origin" />
            </>
          )}
        </ScrollView>

        <SectionHead
          title="Coming Soon"
          onSeeAll={() => navigation.navigate('Shelf', { mode: 'fresh', title: 'Fresh', sub: 'coming' })}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.posterRow}>
          {(comingSoon.length ? comingSoon : []).slice(0, 4).map((s) => (
            <View key={s.id} style={{ width: 118, marginRight: 11 }}>
              <Pressable onPress={() => openSeries(s.id)}>
                {resolveUrl(s.poster_url || s.cover_url) ? (
                  <Image
                    source={{ uri: resolveUrl(s.poster_url || s.cover_url) }}
                    style={{ width: 118, height: 154, borderRadius: 14 }}
                    resizeMode="cover"
                  />
                ) : (
                  <LinearGradient
                    colors={[COLORS.navySoft, '#0d0d24']}
                    style={{ width: 118, height: 154, borderRadius: 14 }}
                  />
                )}
                <Text style={styles.posterTitle} numberOfLines={2}>{s.title}</Text>
              </Pressable>
              <TouchableOpacity style={styles.remindBtn} onPress={() => remind(s.id)}>
                <Clock size={11} color="#C9C9DE" />
                <Text style={styles.remindText}>Remind Me</Text>
              </TouchableOpacity>
            </View>
          ))}
          {!comingSoon.length ? (
            <Text style={styles.softEmpty}>New series will appear here when scheduled.</Text>
          ) : null}
        </ScrollView>

        <Text style={styles.footerCopy}>© 2026 WiamEpisio · Powered by WiamLabs</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  topFixed: { paddingHorizontal: 20, paddingBottom: 10 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandName: {
    fontSize: 17,
    fontFamily: FONTS.extraBold,
    color: '#fff',
    letterSpacing: -0.3,
  },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.navyCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInPill: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.gold,
  },
  signInText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.navy },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.gold,
  },
  coinPillText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.navy },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.navyCard,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 12,
  },
  searchPlaceholder: { fontSize: 12.5, color: COLORS.textFaint, fontFamily: FONTS.regular, flex: 1 },
  tabRow: { gap: 20, paddingBottom: 2 },
  tabBtn: { alignItems: 'center' },
  tab: {
    fontSize: 14,
    fontFamily: FONTS.semi,
    color: COLORS.textFaint,
    paddingBottom: 8,
  },
  tabActive: { color: '#fff' },
  tabUnderline: {
    height: 2,
    width: '100%',
    backgroundColor: COLORS.gold,
    borderRadius: 2,
  },
  scroll: { flex: 1, paddingHorizontal: 20 },
  genreRow: { gap: 8, marginBottom: 22 },
  genreChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
  },
  genreChipActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  genreText: { fontSize: 12, fontFamily: FONTS.medium, color: '#B8B8CC' },
  genreTextActive: { color: COLORS.navy },
  quickRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 18,
  },
  quickChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: 'rgba(212,160,23,0.12)', borderWidth: 1, borderColor: COLORS.gold,
  },
  quickChipText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.gold },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 15, fontFamily: FONTS.bold, color: '#fff' },
  seeAll: { fontSize: 11.5, color: COLORS.gold, fontFamily: FONTS.medium },
  posterRow: { paddingBottom: 4, marginBottom: 22 },
  posterTitle: {
    marginTop: 7,
    fontSize: 11.5,
    fontFamily: FONTS.semi,
    color: '#fff',
    lineHeight: 15,
  },
  posterTag: { marginTop: 2, fontSize: 10, color: COLORS.textFaint, fontFamily: FONTS.regular },
  remindBtn: {
    marginTop: 8,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  remindText: { fontSize: 10.5, fontFamily: FONTS.semi, color: '#C9C9DE' },
  softEmpty: {
    fontSize: 12,
    color: COLORS.textFaint,
    fontFamily: FONTS.regular,
    paddingVertical: 12,
  },
  footerCopy: {
    textAlign: 'center',
    fontSize: 10,
    color: '#3A3A56',
    paddingVertical: 8,
    fontFamily: FONTS.regular,
  },
});

export default HomeScreen;
