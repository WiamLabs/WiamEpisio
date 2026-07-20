/**
 * Search + empty/no-results from WiamEpisio-Search-No-Results.html
 * Idle: popular / top_searched from /watch/home. Query: /watch/search.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Search, Check } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import watchApi from '../../api/watch';
import PosterCard from '../../components/episio/PosterCard';

const CARD_W = (Dimensions.get('window').width - 52) / 2;
const GENRE_CHIPS = ['Drama', 'Revenge', 'Romance', 'Royal', 'Comedy'];
const SEARCH_TIPS = [
  'Check for typos in series or creator names',
  'Use fewer, more general keywords',
  'Try searching by genre, like "Revenge" or "Royal"',
];

const SearchScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const initialQ = route.params?.query || route.params?.q || '';
  const [q, setQ] = useState(initialQ);
  const [results, setResults] = useState([]);
  const [popular, setPopular] = useState([]);
  const [suggestChips, setSuggestChips] = useState([...GENRE_CHIPS]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    watchApi.home().then((home) => {
      const pop = home?.top_searched?.length ? home.top_searched : (home?.popular || []);
      setPopular(pop.slice(0, 12));
      const titles = (pop || []).slice(0, 3).map((s) => s.title).filter(Boolean);
      setSuggestChips([...titles, ...GENRE_CHIPS].slice(0, 6));
    }).catch(() => {});
  }, []);

  const run = useCallback(async (text) => {
    const query = (text ?? q).trim();
    setQ(query);
    if (!query) {
      setResults([]);
      setSearched(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await watchApi.search(query);
      setResults(data?.series || []);
      setSearched(true);
    } catch (e) {
      setError(typeof e === 'string' ? e : (e?.message || 'Search failed'));
      setResults([]);
      setSearched(true);
    } finally {
      setBusy(false);
    }
  }, [q]);

  useEffect(() => {
    if (initialQ.trim()) {
      run(initialQ);
    }
    // Only on mount for deep-link query
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSeries = (id) => {
    if (!id) return;
    navigation.navigate('SeriesDetail', { seriesId: id });
  };

  const listData = searched ? results : popular;
  const showNoResults = searched && !busy && !results.length;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.top}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <ChevronLeft size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.searchBox}>
          <Search size={14} color={COLORS.textFaint} />
          <TextInput
            style={styles.input}
            placeholder="Search series"
            placeholderTextColor={COLORS.textFaint}
            value={q}
            onChangeText={(t) => {
              setQ(t);
              if (!t.trim()) {
                setSearched(false);
                setResults([]);
              }
            }}
            onSubmitEditing={() => run()}
            returnKeyType="search"
            autoFocus
          />
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={showNoResults ? [] : listData}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 20 }}
          contentContainerStyle={{ paddingBottom: 40, gap: 14 }}
          ListHeaderComponent={
            !searched && popular.length ? (
              <Text style={styles.sectionLabel}>Popular right now</Text>
            ) : null
          }
          ListEmptyComponent={
            showNoResults ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>No results for "{q}"</Text>
                <Text style={styles.emptySub}>Try a different spelling, or browse by genre instead.</Text>
                <Text style={styles.tipsTitle}>Search tips</Text>
                {SEARCH_TIPS.map((tip) => (
                  <View key={tip} style={styles.tipRow}>
                    <Check size={14} color={COLORS.gold} />
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
                <Text style={styles.suggestTitle}>Popular right now</Text>
                <View style={styles.chips}>
                  {suggestChips.map((chip) => (
                    <TouchableOpacity
                      key={chip}
                      style={styles.chip}
                      onPress={() => {
                        if (GENRE_CHIPS.includes(chip)) {
                          navigation.navigate('Shelf', { mode: 'category', genre: chip, title: chip });
                        } else {
                          run(chip);
                        }
                      }}
                    >
                      <Text style={styles.chipText}>{chip}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.browseBtn}
                  onPress={() => navigation.navigate('Main')}
                >
                  <Text style={styles.browseText}>Browse popular</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.fullEmptyLink}
                  onPress={() => navigation.navigate('SearchNoResults', {
                    query: q,
                    suggestions: suggestChips,
                  })}
                >
                  <Text style={styles.fullEmptyText}>Open full empty state ›</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.empty}>Type a title or genre, then search.</Text>
            )
          }
          renderItem={({ item }) => (
            <PosterCard
              title={item.title}
              tag={item.genre}
              posterUrl={item.poster_url || item.cover_url}
              width={CARD_W}
              height={170}
              onPress={() => openSeries(item.id)}
            />
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.navyCard,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.navyCard, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  input: { flex: 1, color: COLORS.text, fontFamily: FONTS.regular, fontSize: 14, padding: 0 },
  sectionLabel: {
    paddingHorizontal: 20, marginBottom: 10, marginTop: 4,
    color: COLORS.textMuted || '#B8B8CC', fontFamily: FONTS.semi, fontSize: 13,
  },
  empty: { textAlign: 'center', color: COLORS.textFaint, marginTop: 40, fontFamily: FONTS.medium, paddingHorizontal: 24 },
  emptyWrap: { paddingHorizontal: 24, paddingTop: 28, alignItems: 'center' },
  emptyTitle: { color: '#fff', fontFamily: FONTS.bold, fontSize: 16, textAlign: 'center' },
  emptySub: { marginTop: 8, color: COLORS.textFaint, fontFamily: FONTS.regular, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  tipsTitle: {
    alignSelf: 'stretch', marginTop: 22, marginBottom: 12,
    fontSize: 12, fontFamily: FONTS.extraBold, color: COLORS.textDim,
    letterSpacing: 0.4, textTransform: 'uppercase',
  },
  tipRow: { alignSelf: 'stretch', flexDirection: 'row', gap: 9, marginBottom: 10 },
  tipText: { flex: 1, fontSize: 11.5, color: '#C9C9DE', fontFamily: FONTS.regular, lineHeight: 17 },
  suggestTitle: {
    alignSelf: 'stretch', marginTop: 14, marginBottom: 12,
    fontSize: 12, fontFamily: FONTS.extraBold, color: COLORS.textDim,
    letterSpacing: 0.4, textTransform: 'uppercase',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: {
    paddingHorizontal: 15, paddingVertical: 9, borderRadius: 999,
    backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.navyLine,
  },
  chipText: { color: '#B8B8CC', fontFamily: FONTS.semi, fontSize: 12 },
  browseBtn: {
    marginTop: 22, backgroundColor: COLORS.gold, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12,
  },
  browseText: { fontFamily: FONTS.bold, color: COLORS.navy, fontSize: 13.5 },
  fullEmptyLink: { marginTop: 14, padding: 6 },
  fullEmptyText: { color: COLORS.textDim, fontFamily: FONTS.semi, fontSize: 12 },
  error: { color: COLORS.error, paddingHorizontal: 20, marginBottom: 8, fontFamily: FONTS.medium },
});

export default SearchScreen;
