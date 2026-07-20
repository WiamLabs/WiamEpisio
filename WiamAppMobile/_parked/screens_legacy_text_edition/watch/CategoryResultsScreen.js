/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
/**
 * CategoryResultsScreen — filtered series list from genre chips / See all.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { EPISIO, EPISIO_FONTS } from '../../constants/episioTheme';
import episodesApi from '../../api/episodes';
import PosterCard from '../../components/watch/PosterCard';

const CategoryResultsScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const category = route.params?.category || 'For you';
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = {};
      const cat = String(category || '').toLowerCase();
      if (cat && !['for you', 'trending', 'new releases', 'african originals'].includes(cat)) {
        params.genre = category;
      }
      const res = await episodesApi.listSeries(params);
      setSeries(res?.series || []);
    } catch {
      setSeries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const cat = String(category).toLowerCase();
    if (!cat || cat === 'for you' || cat === 'trending' || cat === 'new releases') {
      return series;
    }
    return series.filter((s) => {
      const g = String(s.genre || '').toLowerCase();
      const t = String(s.title || '').toLowerCase();
      const d = String(s.description || '').toLowerCase();
      if (cat.includes('african')) {
        return g.includes('africa') || d.includes('africa') || t.includes('accra') || t.includes('lagos');
      }
      return g.includes(cat) || t.includes(cat);
    });
  }, [series, category]);

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <ChevronLeft size={22} color={EPISIO.paper} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{category}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={EPISIO.ember} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, flexGrow: 1 }}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={EPISIO.ember}
            />
          )}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptyBody}>Try another category or pull to refresh.</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <PosterCard
              series={item}
              style={{ flex: 1, maxWidth: '48%' }}
              onPress={() => navigation.navigate('SeriesDetail', { seriesId: item.id })}
            />
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: EPISIO.ink900 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: EPISIO_FONTS.display,
    fontSize: 18,
    color: EPISIO.paper,
  },
  row: { gap: 12, marginBottom: 12 },
  empty: { paddingTop: 48, alignItems: 'center', paddingHorizontal: 24 },
  emptyTitle: { fontFamily: EPISIO_FONTS.display, fontSize: 20, color: EPISIO.paper },
  emptyBody: { color: EPISIO.smoke, marginTop: 8, textAlign: 'center', fontFamily: EPISIO_FONTS.ui },
});

export default CategoryResultsScreen;
