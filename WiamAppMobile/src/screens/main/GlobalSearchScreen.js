import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Image } from 'react-native';
import CachedImage from '../../components/common/CachedImage';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import booksApi from '../../api/books';
import { Search, X, Flame } from 'lucide-react-native';
import SkeletonLoader from '../../components/common/SkeletonLoader';
import resolveUrl from '../../utils/resolveUrl';

const GlobalSearchScreen = ({ navigation, route }) => {
  const initialQuery = route.params?.initialQuery || '';
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [topBooks, setTopBooks] = useState([]);
  const [sort, setSort] = useState('popular'); // popular | newest

  useEffect(() => {
    (async () => {
      const res = await booksApi.getBooks({ sort: 'popular', per_page: 16 });
      setTopBooks(res.books || []);
    })();
  }, []);

  useEffect(() => {
    if (!initialQuery) return;
    runSearch(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const runSearch = async (text) => {
    const q = text.trim();
    setQuery(text);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await booksApi.searchBooks(q);
      setResults(res.books || []);
    } finally {
      setLoading(false);
    }
  };

  const sortedResults = useMemo(() => {
    if (sort === 'newest') return [...results].sort((a, b) => (b.id || 0) - (a.id || 0));
    return [...results].sort((a, b) => (b.views || 0) - (a.views || 0));
  }, [results, sort]);

  const dataToShow = query.trim().length >= 2 ? sortedResults : topBooks;
  const hasNoResultForQuery = query.trim().length >= 2 && !loading && dataToShow.length === 0;

  const renderCard = ({ item }) => (
    <TouchableOpacity style={styles.bookCard} onPress={() => navigation.navigate('BookDetail', { bookId: item.id })}>
      <CachedImage source={{ uri: resolveUrl(item.cover_url) }} style={styles.cover} />
      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.cardAuthor} numberOfLines={1}>
        {item.author || 'Unknown'}
      </Text>
      <Text style={styles.cardStats}>👁 {item.views || 0}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Search</Text>
      <View style={styles.searchBar}>
        <Search size={18} color={COLORS.textMuted} />
        <TextInput
          style={styles.input}
          placeholder="Search stories, authors..."
          placeholderTextColor={COLORS.textMuted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => runSearch(query)}
        />
        {query.length > 0 ? (
          <TouchableOpacity onPress={() => runSearch('')}>
            <X size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {query.trim().length >= 2 ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            {dataToShow.length} result{dataToShow.length !== 1 ? 's' : ''} for "{query}"
          </Text>
          <View style={styles.sortRow}>
            <TouchableOpacity style={[styles.sortChip, sort === 'newest' && styles.sortChipActive]} onPress={() => setSort('newest')}>
              <Text style={[styles.sortText, sort === 'newest' && styles.sortTextActive]}>Newest</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sortChip, sort === 'popular' && styles.sortChipActive]} onPress={() => setSort('popular')}>
              <Text style={[styles.sortText, sort === 'popular' && styles.sortTextActive]}>Popular</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.topHeader}>
          <Flame color="#f97316" size={16} />
          <Text style={styles.topHeaderText}>Top Stories</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <SkeletonLoader.BookCard count={4} />
        </View>
      ) : hasNoResultForQuery ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Nothing found for that search...</Text>
          <Text style={styles.emptySub}>Try different words or browse by genre instead.</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => navigation.navigate('Browse')}>
            <Text style={styles.browseBtnText}>Browse Genres</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={dataToShow}
          numColumns={2}
          keyExtractor={(item) => `s-${item.id}`}
          renderItem={renderCard}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  title: {
    color: COLORS.text,
    fontFamily: FONTS.display,
    fontSize: 34,
    marginBottom: SPACING.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    marginLeft: 8,
  },
  metaRow: {
    marginBottom: SPACING.md,
  },
  metaText: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginBottom: SPACING.sm,
  },
  sortRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  sortChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  sortChipActive: {
    borderColor: COLORS.secondary,
    backgroundColor: 'rgba(212,168,67,0.14)',
  },
  sortText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  sortTextActive: {
    color: COLORS.secondary,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.md,
  },
  topHeaderText: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 16,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyWrap: {
    marginTop: 40,
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  emptyTitle: {
    color: COLORS.text,
    fontFamily: FONTS.display,
    fontSize: 24,
    textAlign: 'center',
  },
  emptySub: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  browseBtn: {
    marginTop: SPACING.lg,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(212,168,67,0.12)',
  },
  browseBtnText: {
    color: COLORS.secondary,
    fontWeight: '700',
  },
  grid: {
    paddingBottom: 88,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  bookCard: {
    width: '48%',
  },
  cover: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 13,
    marginTop: 6,
    fontWeight: '600',
  },
  cardAuthor: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  cardStats: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
});

export default GlobalSearchScreen;
