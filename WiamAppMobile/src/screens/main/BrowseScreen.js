import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import CachedImage from '../../components/common/CachedImage';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import booksApi from '../../api/books';
import { Search, Flame, Clock3, Bookmark } from 'lucide-react-native';
import BrandedFooter from '../../components/BrandedFooter';
import AdBanner from '../../components/ads/AdBanner';
import SkeletonLoader from '../../components/common/SkeletonLoader';
import CONFIG from '../../constants/config';
import { cachedFetch } from '../../utils/apiCache';
import resolveUrl from '../../utils/resolveUrl';

const BrowseScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [trending, setTrending] = useState([]);
  const [recent, setRecent] = useState([]);
  const [genres, setGenres] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [genreBooks, setGenreBooks] = useState([]);
  const [genreLoading, setGenreLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const applyBrowse = (d) => {
          setTrending(d.trending || []);
          setRecent(d.recent || []);
          setGenres(d.genres || []);
        };
        const data = await cachedFetch(
          'browse_screen',
          async () => {
            const [trendingRes, recentRes, genresRes] = await Promise.all([
              booksApi.getTrending().catch(() => ({})),
              booksApi.getBooks({ sort: 'latest', per_page: 20 }).catch(() => ({})),
              booksApi.getGenres().catch(() => ({})),
            ]);
            return {
              trending: trendingRes?.books || [],
              recent: recentRes?.books || [],
              genres: genresRes?.genres || [],
            };
          },
          (freshData) => applyBrowse(freshData),
          10 * 60 * 1000,
        );
        applyBrowse(data);
      } catch {
        setTrending([]);
        setRecent([]);
        setGenres([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedGenre) {
      setGenreBooks([]);
      return;
    }
    (async () => {
      setGenreLoading(true);
      try {
        const res = await booksApi.getBooks({ genre: selectedGenre, per_page: 30 });
        setGenreBooks(res?.books || []);
      } catch {
        setGenreBooks([]);
      } finally {
        setGenreLoading(false);
      }
    })();
  }, [selectedGenre]);

  const onSearchSubmit = () => {
    const q = searchQuery.trim();
    if (!q) return;
    navigation.navigate('GlobalSearch', { initialQuery: q });
  };

  const genreNames = useMemo(() => genres.map((g) => g.name), [genres]);

  const renderSmallCard = ({ item }) => (
    <TouchableOpacity style={styles.smallCard} onPress={() => navigation.navigate('BookDetail', { bookId: item.id })}>
      <CachedImage source={{ uri: resolveUrl(item.cover_url) }} style={styles.smallCover} />
      <Text style={styles.smallTitle} numberOfLines={1}>
        {item.title}
      </Text>
    </TouchableOpacity>
  );

  const renderGenreBook = ({ item }) => (
    <TouchableOpacity style={styles.genreBookCard} onPress={() => navigation.navigate('BookDetail', { bookId: item.id })}>
      <CachedImage source={{ uri: resolveUrl(item.cover_url) }} style={styles.genreBookCover} />
      <Text style={styles.genreBookTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.genreBookAuthor} numberOfLines={1}>
        {item.author || 'Unknown'}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return <SkeletonLoader.Home />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Browse</Text>
      <Text style={styles.subtitle}>Explore stories by genre</Text>

      <View style={styles.searchWrap}>
        <Search color={COLORS.textMuted} size={18} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search stories, authors, genres..."
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={onSearchSubmit}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.secHead}>
          <Flame color="#f97316" size={15} />
          <Text style={styles.secTitle}>Trending Now</Text>
        </View>
        <FlatList horizontal showsHorizontalScrollIndicator={false} data={trending} renderItem={renderSmallCard} keyExtractor={(item) => `tr-${item.id}`} />
      </View>

      <View style={styles.section}>
        <View style={styles.secHead}>
          <Clock3 color="#38bdf8" size={15} />
          <Text style={styles.secTitle}>Recently Added</Text>
        </View>
        <FlatList horizontal showsHorizontalScrollIndicator={false} data={recent} renderItem={renderSmallCard} keyExtractor={(item) => `rc-${item.id}`} />
      </View>

      <View style={styles.section}>
        <View style={styles.secHead}>
          <Bookmark color={COLORS.secondary} size={15} />
          <Text style={styles.secTitle}>Genres</Text>
        </View>
        <View style={styles.genreGrid}>
          {genreNames.map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.genreChip, selectedGenre === g && styles.genreChipActive]}
              onPress={() => setSelectedGenre((prev) => (prev === g ? '' : g))}
            >
              <Text style={[styles.genreChipText, selectedGenre === g && styles.genreChipTextActive]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {selectedGenre ? (
        <View style={styles.section}>
          <Text style={styles.selectedLabel}>{selectedGenre}</Text>
          {genreLoading ? (
            <ActivityIndicator color={COLORS.secondary} style={{ marginTop: SPACING.md }} />
          ) : (
            <FlatList
              data={genreBooks}
              numColumns={3}
              keyExtractor={(item) => `gb-${item.id}`}
              renderItem={renderGenreBook}
              scrollEnabled={false}
              columnWrapperStyle={styles.genreRow}
            />
          )}
        </View>
      ) : null}

      <AdBanner placement="browse" navigation={navigation} />

      <View style={styles.footerPush}>
        <BrandedFooter compact />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: 24,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  title: {
    color: COLORS.text,
    fontFamily: FONTS.display,
    fontSize: 34,
  },
  subtitle: {
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: SPACING.md,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    marginLeft: 8,
    fontSize: 14,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  secHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  secTitle: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 15,
  },
  smallCard: {
    width: 110,
    marginRight: 10,
  },
  smallCover: {
    width: 110,
    height: 155,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
  },
  smallTitle: {
    color: COLORS.text,
    fontSize: 12,
    marginTop: 5,
  },
  genreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genreChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  genreChipActive: {
    borderColor: COLORS.secondary,
  },
  genreChipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  genreChipTextActive: {
    color: COLORS.secondary,
    fontWeight: '700',
  },
  selectedLabel: {
    color: COLORS.secondary,
    fontWeight: '700',
    fontSize: 14,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },
  genreRow: {
    gap: 10,
    marginBottom: SPACING.md,
  },
  genreBookCard: {
    width: 104,
  },
  genreBookCover: {
    width: 104,
    height: 146,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
  },
  genreBookTitle: {
    color: COLORS.text,
    fontSize: 12,
    marginTop: 5,
  },
  genreBookAuthor: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  footerPush: {
    marginTop: 'auto',
    paddingTop: SPACING.xl,
  },
});

export default BrowseScreen;

