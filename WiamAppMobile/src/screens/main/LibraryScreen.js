import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import booksApi from '../../api/books';
import { BookOpen, Search, Heart, CheckCircle2, Library, List, Plus, ChevronRight } from 'lucide-react-native';
import SkeletonLoader from '../../components/common/SkeletonLoader';
import { selectionTick } from '../../utils/haptics';
import BrandedFooter from '../../components/BrandedFooter';
import CONFIG from '../../constants/config';
import { cachedFetch } from '../../utils/apiCache';
import resolveUrl from '../../utils/resolveUrl';

const TABS = [
  { key: 'reading', label: 'Reading', icon: BookOpen },
  { key: 'completed', label: 'Completed', icon: CheckCircle2 },
  { key: 'favorites', label: 'Favorites', icon: Heart },
  { key: 'lists', label: 'Lists', icon: List },
];

const LibraryScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [allBooks, setAllBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('reading');
  const [readingLists, setReadingLists] = useState([]);
  const [listsLoading, setListsLoading] = useState(false);

  useEffect(() => {
    fetchLibrary();
  }, []);

  useEffect(() => {
    if (activeTab === 'lists') fetchReadingLists();
  }, [activeTab]);

  const fetchReadingLists = async () => {
    setListsLoading(true);
    try {
      const res = await booksApi.getReadingLists();
      setReadingLists(res.lists || []);
    } catch (e) {
      console.error('Error fetching reading lists', e);
    } finally {
      setListsLoading(false);
    }
  };

  const createNewList = async () => {
    try {
      const res = await booksApi.createReadingList('New List');
      if (res.list) {
        setReadingLists((prev) => [res.list, ...prev]);
        navigation.navigate('ReadingListDetail', { listId: res.list.id });
      }
    } catch (e) {
      console.error('Error creating list', e);
    }
  };

  const fetchLibrary = async () => {
    if (!refreshing) setLoading(true);
    try {
      const data = await cachedFetch(
        'library_screen',
        async () => {
          const response = await booksApi.getMyLibrary();
          return { books: response.books || [] };
        },
        (freshData) => setAllBooks(freshData.books || []),
        5 * 60 * 1000,
      );
      setAllBooks(data.books || []);
    } catch (error) {
      console.error('Error fetching library', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLibrary();
  }, []);

  // Split books into tabs based on reading progress and favorite status
  const filteredBooks = useMemo(() => {
    if (activeTab === 'completed') {
      return allBooks.filter((b) => {
        const current = b.reading_progress?.current_chapter || 0;
        const total = b.chapter_count || b.chapters?.length || 0;
        return total > 0 && current >= total;
      });
    }
    if (activeTab === 'favorites') {
      return allBooks.filter((b) => b.is_favorited || b.is_favorite || b.in_favorites);
    }
    // "reading" — in progress (not completed)
    return allBooks.filter((b) => {
      const current = b.reading_progress?.current_chapter || 0;
      const total = b.chapter_count || b.chapters?.length || 0;
      return total === 0 || current < total;
    });
  }, [allBooks, activeTab]);

  const renderBookItem = ({ item }) => {
    const current = item.reading_progress?.current_chapter || 1;
    const total = item.chapter_count || item.chapters?.length || 1;
    const pct = Math.max(4, Math.min(100, Math.round((current / Math.max(total, 1)) * 100)));

    return (
      <TouchableOpacity
        style={styles.bookCard}
        onPress={() => navigation.navigate('BookDetail', { bookId: item.id })}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: resolveUrl(item.cover_url) || 'https://via.placeholder.com/150x225' }}
          style={styles.bookCover}
        />
        <View style={styles.bookInfo}>
          <Text style={styles.bookTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.bookAuthor} numberOfLines={1}>{item.author}</Text>

          {activeTab !== 'completed' && (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct}%` }]} />
              </View>
              <Text style={styles.progressLabel}>Chapter {current} of {total}</Text>
            </View>
          )}

          {activeTab === 'completed' && (
            <View style={styles.completedBadge}>
              <CheckCircle2 size={12} color="#4ade80" />
              <Text style={styles.completedText}>Completed</Text>
            </View>
          )}

          {item.genre && (
            <View style={styles.genreBadge}>
              <Text style={styles.genreText}>{item.genre}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.readBtn}
          onPress={() => navigation.navigate('Reader', { bookId: item.id, chNum: activeTab === 'completed' ? 1 : current })}
        >
          <BookOpen color={COLORS.secondary} size={20} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Library size={20} color={COLORS.secondary} />
          <Text style={styles.headerTitle}>My Library</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('GlobalSearch')}
          hitSlop={12}
        >
          <Search size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => { selectionTick(); setActiveTab(tab.key); }}
              activeOpacity={0.7}
            >
              <Icon size={15} color={active ? COLORS.secondary : COLORS.textMuted} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {activeTab === 'lists' ? (
        <FlatList
          data={readingLists}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={listsLoading} onRefresh={fetchReadingLists} tintColor={COLORS.secondary} />
          }
          ListHeaderComponent={
            <TouchableOpacity style={styles.createListBtn} onPress={createNewList} activeOpacity={0.7}>
              <Plus size={18} color={COLORS.secondary} />
              <Text style={styles.createListText}>Create New List</Text>
            </TouchableOpacity>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.rlCard}
              onPress={() => navigation.navigate('ReadingListDetail', { listId: item.id })}
              activeOpacity={0.7}
            >
              {item.cover_url ? (
                <Image source={{ uri: resolveUrl(item.cover_url) }} style={styles.rlCover} />
              ) : (
                <View style={[styles.rlCover, styles.rlCoverPlaceholder]}>
                  <Library size={22} color={COLORS.textMuted} />
                </View>
              )}
              <View style={styles.rlInfo}>
                <Text style={styles.rlName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.rlMeta}>{item.item_count || 0} book{item.item_count !== 1 ? 's' : ''}{!item.is_public ? ' · Private' : ''}</Text>
              </View>
              <ChevronRight size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            !listsLoading && (
              <View style={styles.empty}>
                <List color={COLORS.textMuted} size={56} strokeWidth={1} />
                <Text style={styles.emptyTitle}>No reading lists yet</Text>
                <Text style={styles.emptySub}>Create a list to organize your favorite books</Text>
              </View>
            )
          }
          ListFooterComponent={readingLists.length > 0 ? <BrandedFooter compact /> : null}
        />
      ) : loading && !refreshing ? (
        <View style={styles.skeletonWrap}>
          <SkeletonLoader.ListItem count={5} />
        </View>
      ) : (
        <FlatList
          data={filteredBooks}
          renderItem={renderBookItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.secondary} />
          }
          ListFooterComponent={filteredBooks.length > 0 ? <BrandedFooter compact /> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              {activeTab === 'reading' && <BookOpen color={COLORS.textMuted} size={56} strokeWidth={1} />}
              {activeTab === 'completed' && <CheckCircle2 color={COLORS.textMuted} size={56} strokeWidth={1} />}
              {activeTab === 'favorites' && <Heart color={COLORS.textMuted} size={56} strokeWidth={1} />}
              {activeTab === 'lists' && <List color={COLORS.textMuted} size={56} strokeWidth={1} />}
              <Text style={styles.emptyTitle}>
                {activeTab === 'reading' && 'No books in progress'}
                {activeTab === 'completed' && 'No completed books yet'}
                {activeTab === 'favorites' && 'No favorites yet'}
              </Text>
              <Text style={styles.emptySub}>
                {activeTab === 'reading' && 'Start reading a book and it will appear here'}
                {activeTab === 'completed' && 'Finish reading a book to see it here'}
                {activeTab === 'favorites' && 'Tap the heart icon on a book to add it to favorites'}
              </Text>
              <TouchableOpacity
                style={styles.browseBtn}
                onPress={() => navigation.navigate('Browse')}
              >
                <Text style={styles.browseBtnText}>Browse Books</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tabActive: {
    backgroundColor: 'rgba(212,168,67,0.12)',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  tabLabelActive: {
    color: COLORS.secondary,
  },
  skeletonWrap: {
    flex: 1,
    paddingTop: SPACING.md,
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  bookCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  bookCover: {
    width: 56,
    height: 84,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  bookInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    justifyContent: 'center',
  },
  bookTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  bookAuthor: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  progressWrap: {
    marginTop: 8,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    width: '85%',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.secondary,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 3,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  completedText: {
    fontSize: 12,
    color: '#4ade80',
    fontWeight: '600',
  },
  genreBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 6,
  },
  genreText: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  readBtn: {
    padding: SPACING.sm,
    borderRadius: 20,
    backgroundColor: 'rgba(212,168,67,0.1)',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  browseBtn: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: RADIUS.full,
  },
  browseBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
  },
  createListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(212,168,67,0.1)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.2)',
    borderStyle: 'dashed',
    justifyContent: 'center',
  },
  createListText: {
    color: COLORS.secondary,
    fontWeight: '600',
    fontSize: 14,
  },
  rlCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  rlCover: {
    width: 48,
    height: 64,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rlCoverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rlInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  rlName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  rlMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});

export default LibraryScreen;
