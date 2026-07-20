/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 full park.
 * Do not wire into active navigation. Awaiting HTML mockups.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
/**
 * GlobalSearch — series search (watch-first).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, X } from 'lucide-react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import episodesApi from '../../api/episodes';
import PosterCard from '../../components/watch/PosterCard';

const GlobalSearchScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const initialQuery = route.params?.initialQuery || '';
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await episodesApi.listSeries();
        setSeries(res?.series || []);
      } catch {
        setSeries([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return series;
    return series.filter((s) => {
      const hay = `${s.title || ''} ${s.genre || ''} ${s.description || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [series, query]);

  return (
    <View style={[styles.page, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>Search</Text>
      <View style={styles.searchBar}>
        <Search size={18} color={COLORS.textFaint} />
        <TextInput
          style={styles.input}
          placeholder="Search series…"
          placeholderTextColor={COLORS.textFaint}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')}>
            <X size={18} color={COLORS.textDim} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, flexGrow: 1 }}
          ListEmptyComponent={(
            <Text style={styles.empty}>No series match that search.</Text>
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
  page: {
    flex: 1,
    backgroundColor: COLORS.navy,
    paddingHorizontal: SPACING.md,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.navyLine,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: SPACING.md,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.regular,
    fontSize: 14,
    padding: 0,
  },
  row: { gap: 12, marginBottom: 12 },
  empty: {
    color: COLORS.textDim,
    fontFamily: FONTS.regular,
    textAlign: 'center',
    marginTop: 40,
  },
});

export default GlobalSearchScreen;
