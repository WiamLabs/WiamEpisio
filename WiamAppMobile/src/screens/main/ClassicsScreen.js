import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { COLORS, SPACING, RADIUS, FONTS } from '../../constants/theme';
import AppBackground from '../../components/AppBackground';
import classicsApi from '../../api/classics';
import { ChevronLeft, BookOpen, Star, Eye, Library, Filter } from 'lucide-react-native';
import SkeletonLoader from '../../components/common/SkeletonLoader';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const CARD_W = (width - SPACING.lg * 2 - SPACING.md) / 2;

const GENRES = ['All', 'Fiction', 'Adventure', 'Romance', 'Science Fiction', 'Mystery', 'Fantasy', 'Classic'];

const formatNumber = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const ClassicsScreen = ({ navigation }) => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchData = useCallback(async (p = 1, genre = selectedGenre, append = false) => {
    try {
      const g = genre === 'All' ? '' : genre;
      const res = await classicsApi.list(p, g);
      if (append) {
        setBooks(prev => [...prev, ...(res.books || [])]);
      } else {
        setBooks(res.books || []);
      }
      setTotalPages(res.total_pages || 1);
    } catch (err) {
      console.warn('Classics fetch error:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [selectedGenre]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchData(1, selectedGenre);
  }, [selectedGenre]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchData(1, selectedGenre);
  };

  const loadMore = () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    const next = page + 1;
    setPage(next);
    fetchData(next, selectedGenre, true);
  };

  const renderBook = ({ item }) => (
    <TouchableOpacity
      style={styles.bookCard}
      activeOpacity={0.8}
      onPress={() => {
        if (item.content_id) {
          navigation.navigate('BookDetail', { bookId: item.content_id });
        }
      }}
    >
      {item.cover_image ? (
        <Image source={{ uri: item.cover_image }} style={styles.bookCover} />
      ) : (
        <View style={[styles.bookCover, styles.coverPlaceholder]}>
          <BookOpen size={28} color={COLORS.textMuted} />
        </View>
      )}
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.bookAuthor} numberOfLines={1}>{item.author}</Text>
        <View style={styles.bookMeta}>
          {item.rating > 0 && (
            <View style={styles.metaItem}>
              <Star size={11} color={COLORS.secondary} />
              <Text style={styles.metaText}>{item.rating.toFixed(1)}</Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Eye size={11} color={COLORS.textMuted} />
            <Text style={styles.metaText}>{formatNumber(item.views)}</Text>
          </View>
        </View>
        {item.genre ? (
          <Text style={styles.bookGenre}>{item.genre}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <AppBackground>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Library size={20} color={COLORS.secondary} />
          <Text style={styles.headerTitle}>Classics</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Hero */}
      <LinearGradient
        colors={['rgba(114, 47, 55, 0.12)', 'transparent']}
        style={styles.heroBanner}
      >
        <Text style={styles.heroTitle}>Timeless Literature</Text>
        <Text style={styles.heroSubtitle}>
          Public-domain masterpieces from the world's greatest authors, free to read.
        </Text>
      </LinearGradient>

      {/* Genre Filter */}
      <FlatList
        horizontal
        data={GENRES}
        keyExtractor={(g) => g}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.genreBar}
        renderItem={({ item: genre }) => (
          <TouchableOpacity
            style={[styles.genreChip, selectedGenre === genre && styles.genreChipActive]}
            onPress={() => setSelectedGenre(genre)}
          >
            <Text style={[styles.genreText, selectedGenre === genre && styles.genreTextActive]}>
              {genre}
            </Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <View style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.md }}>
          <SkeletonLoader.ListItem count={6} />
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(b) => String(b.id)}
          renderItem={renderBook}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.secondary} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Library size={64} color={COLORS.textMuted} strokeWidth={1} />
              <Text style={styles.emptyTitle}>No Classics Found</Text>
              <Text style={styles.emptySubtitle}>
                Classic novels will appear here once they are published.
              </Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 40 }} />}
        />
      )}
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingTop: 50, paddingBottom: SPACING.sm,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: {
    fontSize: 20, fontWeight: '700', color: COLORS.text,
    fontFamily: FONTS.display,
  },

  heroBanner: {
    marginHorizontal: SPACING.lg, marginTop: SPACING.sm,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(114, 47, 55, 0.15)',
  },
  heroTitle: {
    fontSize: 20, fontWeight: '700', color: COLORS.text,
    fontFamily: FONTS.display,
  },
  heroSubtitle: {
    fontSize: 13, color: COLORS.textSecondary, textAlign: 'center',
    marginTop: SPACING.xs, lineHeight: 18,
  },

  genreBar: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: SPACING.sm,
  },
  genreChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: COLORS.border,
  },
  genreChipActive: {
    backgroundColor: COLORS.primary + '30',
    borderColor: COLORS.primary,
  },
  genreText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  genreTextActive: { color: COLORS.primaryLight, fontWeight: '600' },

  listContent: { paddingHorizontal: SPACING.lg },
  row: { justifyContent: 'space-between', marginBottom: SPACING.md },

  bookCard: {
    width: CARD_W, borderRadius: RADIUS.md, overflow: 'hidden',
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },
  bookCover: {
    width: '100%', height: CARD_W * 1.35,
    backgroundColor: COLORS.surface,
  },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  bookInfo: { padding: SPACING.sm },
  bookTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text, lineHeight: 17 },
  bookAuthor: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  bookMeta: { flexDirection: 'row', gap: SPACING.sm, marginTop: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 10, color: COLORS.textMuted },
  bookGenre: {
    fontSize: 9, color: COLORS.primary, fontWeight: '600',
    marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },

  emptyState: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginTop: SPACING.md },
  emptySubtitle: {
    fontSize: 13, color: COLORS.textMuted, textAlign: 'center',
    marginTop: SPACING.xs, paddingHorizontal: SPACING.xl, lineHeight: 18,
  },
});

export default ClassicsScreen;
