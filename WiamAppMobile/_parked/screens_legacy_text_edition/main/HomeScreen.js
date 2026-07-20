/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
/**
 * HomeScreen — WiamEpisio Watch Home (html/watch-home.html + Wattpad recommend block).
 * Tab Home. Guest-safe.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Search, Coins } from 'lucide-react-native';
import {
  EPISIO, EPISIO_FONTS, GENRE_CHIPS,
} from '../../constants/episioTheme';
import episodesApi from '../../api/episodes';
import coinsApi from '../../api/coins';
import useAuthStore from '../../store/useAuthStore';
import GenreChips from '../../components/watch/GenreChips';
import HeroSeriesCard from '../../components/watch/HeroSeriesCard';
import SectionHeader from '../../components/watch/SectionHeader';
import PosterCard from '../../components/watch/PosterCard';
import RecommendBlock from '../../components/watch/RecommendBlock';
import FreeRing from '../../components/watch/FreeRing';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_GAP = 12;
const POSTER_W = (SCREEN_W - 32 - GRID_GAP) / 2;

const HomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [series, setSeries] = useState([]);
  const [continueItems, setContinueItems] = useState([]);
  const [balance, setBalance] = useState(null);
  const [chip, setChip] = useState('For you');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const listRes = await episodesApi.listSeries();
      setSeries(listRes?.series || []);
      if (isAuthenticated) {
        try {
          const cw = await episodesApi.continueWatching();
          setContinueItems(cw?.continue_watching || []);
        } catch {
          setContinueItems([]);
        }
        try {
          const bal = await coinsApi.getBalance();
          setBalance(bal?.balance ?? bal?.coins ?? 0);
        } catch {
          setBalance(null);
        }
      } else {
        setContinueItems([]);
        setBalance(null);
      }
    } catch (e) {
      setError(typeof e === 'string' ? e : e?.message || 'Could not load Watch');
      setSeries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const openSeries = (item) => {
    if (!item?.id) return;
    navigation.navigate('SeriesDetail', { seriesId: item.id });
  };

  const openCategory = (label) => {
    setChip(label);
    if (label === 'For you') return;
    navigation.navigate('CategoryResults', { category: label });
  };

  const hero = series[0] || null;
  const recommend = series.slice(0, 5);
  const trending = series.slice(0, 4);
  const fresh = series.slice(0, 8);

  const filteredContinue = continueItems;

  if (loading && !refreshing) {
    return (
      <View style={[styles.page, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={EPISIO.ember} />
      </View>
    );
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={EPISIO.ember}
          />
        )}
      >
        <View style={styles.topRow}>
          <Text style={styles.wordmark}>WiamApp</Text>
          <View style={styles.topActions}>
            <TouchableOpacity onPress={() => navigation.navigate('GlobalSearch')} hitSlop={8}>
              <Search size={18} color={EPISIO.smoke} />
            </TouchableOpacity>
            {isAuthenticated && balance != null ? (
              <View style={styles.coinChip}>
                <Coins size={14} color={EPISIO.ember} />
                <Text style={styles.coinText}>{balance}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <GenreChips chips={GENRE_CHIPS} active={chip} onSelect={openCategory} />

        {error ? <Text style={styles.err}>{error}</Text> : null}

        {hero ? (
          <HeroSeriesCard
            series={hero}
            onWatch={() => {
              openSeries(hero);
            }}
          />
        ) : (
          <View style={styles.emptyHero}>
            <Text style={styles.emptyTitle}>No series yet</Text>
            <Text style={styles.emptyBody}>Pull to refresh when drama series go live.</Text>
          </View>
        )}

        {filteredContinue.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title="Continue watching"
              onAction={() => navigation.navigate('Library')}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              {filteredContinue.map((item, i) => {
                const pct = item.progress_pct
                  ?? (item.seconds_watched && item.duration_seconds
                    ? Math.round((item.seconds_watched / item.duration_seconds) * 100)
                    : 30);
                return (
                  <TouchableOpacity
                    key={String(item.episode?.id || i)}
                    style={styles.cwCard}
                    onPress={() => {
                      const seriesId = item.series?.id;
                      const episodeId = item.episode?.id;
                      if (!seriesId) return;
                      navigation.navigate('Player', { seriesId, episodeId });
                    }}
                  >
                    <FreeRing pct={pct} size={64} label={`EP ${item.episode?.episode_number || '?'}`} />
                    <Text style={styles.cwTitle} numberOfLines={1}>{item.series?.title || 'Series'}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {recommend.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title="Recommended for you"
              onAction={() => navigation.navigate('CategoryResults', { category: 'For you' })}
            />
            <RecommendBlock items={recommend} onPressSeries={openSeries} />
          </View>
        ) : null}

        {trending.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title="Trending now"
              onAction={() => navigation.navigate('CategoryResults', { category: 'Trending' })}
            />
            <View style={styles.grid2}>
              {trending.map((s) => (
                <PosterCard
                  key={String(s.id)}
                  series={s}
                  width={POSTER_W}
                  onPress={() => openSeries(s)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {fresh.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title="New releases"
              onAction={() => navigation.navigate('CategoryResults', { category: 'New releases' })}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {fresh.map((s) => (
                <PosterCard
                  key={`new-${s.id}`}
                  series={s}
                  width={130}
                  onPress={() => openSeries(s)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: EPISIO.ink900 },
  center: { alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16, paddingTop: 6, gap: 22 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: {
    fontFamily: EPISIO_FONTS.display,
    fontSize: 17,
    color: EPISIO.paper,
  },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  coinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: EPISIO.ink700,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  coinText: {
    fontSize: 12,
    fontFamily: EPISIO_FONTS.uiBold,
    color: EPISIO.ember,
  },
  signInChip: {
    borderWidth: 1,
    borderColor: EPISIO.ember,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  signInText: {
    fontSize: 12,
    fontFamily: EPISIO_FONTS.uiSemi,
    color: EPISIO.ember,
  },
  section: { gap: 0 },
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  cwCard: { width: 112, alignItems: 'center', gap: 6 },
  cwTitle: {
    fontSize: 11,
    fontFamily: EPISIO_FONTS.uiSemi,
    color: EPISIO.paper,
    textAlign: 'center',
  },
  emptyHero: {
    height: 160,
    borderRadius: 18,
    backgroundColor: EPISIO.ink800,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontFamily: EPISIO_FONTS.display,
    fontSize: 20,
    color: EPISIO.paper,
    marginBottom: 6,
  },
  emptyBody: { color: EPISIO.smoke, fontFamily: EPISIO_FONTS.ui, textAlign: 'center' },
  err: { color: EPISIO.coral, fontFamily: EPISIO_FONTS.uiMedium, fontSize: 13 },
});

export default HomeScreen;
