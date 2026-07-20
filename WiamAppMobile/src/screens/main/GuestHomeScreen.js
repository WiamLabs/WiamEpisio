import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, ScrollView } from 'react-native';
import CachedImage from '../../components/common/CachedImage';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import booksApi from '../../api/books';
import { cachedFetch } from '../../utils/apiCache';

const GuestHomeScreen = ({ navigation }) => {
  const [latest, setLatest] = useState([]);
  const [trending, setTrending] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  const applyData = (d) => {
    setLatest(d.latest || []);
    setTrending(d.trending || []);
    setFeatured(d.featured || []);
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await cachedFetch(
          'guest_home',
          async () => {
            const [latestRes, trendingRes, featuredRes] = await Promise.all([
              booksApi.getBooks({ sort: 'latest', per_page: 12 }).catch(() => ({})),
              booksApi.getTrending().catch(() => ({})),
              booksApi.getFeatured().catch(() => ({})),
            ]);
            return {
              latest: latestRes.books || [],
              trending: trendingRes.books || [],
              featured: featuredRes.books || [],
            };
          },
          (freshData) => applyData(freshData),
          10 * 60 * 1000,
        );
        applyData(data);
      } catch {
        setLatest([]);
        setTrending([]);
        setFeatured([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.secondary} size="large" />
      </View>
    );
  }

  const renderCover = ({ item }) => (
    <TouchableOpacity style={styles.coverCard} onPress={() => navigation.navigate('BookDetail', { bookId: item.id })}>
      <CachedImage source={{ uri: item.cover_url }} style={styles.cover} />
      <Text style={styles.bookTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.author} numberOfLines={1}>
        {item.author}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.badge}>Free Stories, Unlimited Imagination</Text>
        <Text style={styles.title}>Discover Stories That Move Your Soul</Text>
        <Text style={styles.subtitle}>
          WiamApp is a free reading platform where you discover stories from talented creators across Africa and beyond.
        </Text>
        <View style={styles.ctaRow}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.getParent()?.navigate('Register')}>
            <Text style={styles.primaryBtnText}>Start Reading Free</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={() => navigation.navigate('Browse')}>
            <Text style={styles.ghostBtnText}>Browse Stories</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>New Releases</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={latest}
        keyExtractor={(item) => `latest-${item.id}`}
        renderItem={renderCover}
        contentContainerStyle={styles.hList}
      />

      <Text style={styles.sectionTitle}>Trending Now</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={trending}
        keyExtractor={(item) => `trending-${item.id}`}
        renderItem={renderCover}
        contentContainerStyle={styles.hList}
      />

      <Text style={styles.sectionTitle}>Editor's Choice</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={featured}
        keyExtractor={(item) => `featured-${item.id}`}
        renderItem={renderCover}
        contentContainerStyle={styles.hList}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingTop: SPACING.md, paddingBottom: 90 },
  loading: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  hero: {
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  badge: {
    color: COLORS.secondary,
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 8,
  },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '700', lineHeight: 34 },
  subtitle: { color: COLORS.textSecondary, marginTop: 8, fontSize: 14, lineHeight: 20 },
  ctaRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  primaryBtn: {
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.full,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  primaryBtnText: { color: COLORS.black, fontWeight: '700', fontSize: 13 },
  ghostBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: COLORS.surface,
  },
  ghostBtnText: { color: COLORS.text, fontWeight: '700', fontSize: 13 },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  hList: { paddingHorizontal: SPACING.lg },
  coverCard: { width: 116, marginRight: SPACING.md },
  cover: { width: '100%', aspectRatio: 0.68, borderRadius: RADIUS.md, backgroundColor: COLORS.surface },
  bookTitle: { color: COLORS.text, fontWeight: '700', marginTop: 8, fontSize: 13 },
  author: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
});

export default GuestHomeScreen;
