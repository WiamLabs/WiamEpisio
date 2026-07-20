/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 (Text Edition park).
 * Do not wire into active navigation. Pending possible future Text Edition.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
/**
 * SeriesDetailScreen ΓÇö public reader page (Push 10).
 *
 * Reads /api/v1/series/<id>/public to render an ordered list of books in
 * a series. Tapping a book opens BookDetail. We surface the first book's
 * "Start reading" CTA at the top so a reader who lands on the series can
 * jump straight into chapter 1.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  RefreshControl, ActivityIndicator, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Layers, Globe, Play, ChevronRight, Share2,
} from 'lucide-react-native';
import CachedImage from '../../components/common/CachedImage';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import resolveUrl from '../../utils/resolveUrl';
import studioV2Api from '../../api/studioV2';

const SeriesDetailScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { seriesId } = route.params || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await studioV2Api.getSeriesPublic(seriesId);
      setData(res);
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Could not load this series.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [seriesId]);

  useEffect(() => { load(); }, [load]);

  const onShare = async () => {
    if (!data?.series) return;
    try {
      await Share.share({
        message: `"${data.series.title}" on WiamApp`,
        url: `https://wiamapp.com/series/${data.series.id}`,
      });
    } catch {}
  };

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  if (error || !data?.series) {
    return (
      <View style={[styles.loadingWrap, { paddingTop: insets.top }]}>
        <Text style={{ color: COLORS.textMuted, marginBottom: 12 }}>
          {error || 'Series not found.'}
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backInline}>
          <Text style={{ color: COLORS.accent, fontWeight: '700' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const s = data.series;
  const books = data.books || [];
  const universe = data.universe;
  const creator = data.creator;
  const firstBook = books[0];

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 56 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={COLORS.accent}
          />
        }
      >
        <View style={styles.coverWrap}>
          {s.cover_url ? (
            <CachedImage source={{ uri: resolveUrl(s.cover_url) }} style={styles.coverImg} />
          ) : (
            <View style={[styles.coverImg, styles.coverPlaceholder]}>
              <Layers size={48} color="rgba(255,255,255,0.2)" />
            </View>
          )}
          <View style={styles.coverShade} />
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Layers size={14} color={COLORS.accent} />
            <Text style={styles.kind}>SERIES</Text>
            {s.status ? (
              <Text style={styles.statusPill}>{s.status.toUpperCase()}</Text>
            ) : null}
          </View>
          <Text style={styles.title}>{s.title}</Text>

          {universe ? (
            <TouchableOpacity
              style={styles.universeRow}
              onPress={() => navigation.navigate('UniverseDetail', { universeId: universe.id })}
            >
              <Globe size={12} color={COLORS.textMuted} />
              <Text style={styles.universeText} numberOfLines={1}>
                Part of <Text style={{ color: COLORS.accent }}>{universe.title}</Text>
              </Text>
            </TouchableOpacity>
          ) : null}

          {creator ? (
            <TouchableOpacity
              style={styles.creatorRow}
              onPress={() => navigation.navigate('CreatorProfile', {
                creatorId: creator.wiam_id,
                username: creator.username,
              })}
            >
              {creator.avatar_url ? (
                <Image source={{ uri: resolveUrl(creator.avatar_url) }} style={styles.creatorAvatar} />
              ) : (
                <View style={[styles.creatorAvatar, styles.creatorAvatarPh]}>
                  <Text style={{ color: COLORS.accent, fontWeight: '700' }}>
                    {(creator.creator_pen_name || creator.username || 'W')[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.creatorName} numberOfLines={1}>
                by {creator.creator_pen_name || creator.username || 'Creator'}
              </Text>
            </TouchableOpacity>
          ) : null}

          {s.description ? (
            <Text style={styles.desc}>{s.description}</Text>
          ) : null}

          {firstBook ? (
            <TouchableOpacity
              style={styles.startBtn}
              onPress={() => navigation.navigate('BookDetail', { bookId: firstBook.id })}
            >
              <Play size={14} color="#000" fill="#000" />
              <Text style={styles.startBtnText}>Start with ΓÇ£{firstBook.title}ΓÇ¥</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Reading order</Text>

          {books.length === 0 ? (
            <View style={styles.empty}>
              <Layers size={20} color={COLORS.accent} />
              <Text style={styles.emptyText}>No books published yet ΓÇö check back soon.</Text>
            </View>
          ) : (
            books.map((b, idx) => (
              <TouchableOpacity
                key={`b-${b.id}`}
                style={styles.bookRow}
                onPress={() => navigation.navigate('BookDetail', { bookId: b.id })}
              >
                <Text style={styles.bookOrder}>{idx + 1}</Text>
                {b.cover_url ? (
                  <CachedImage source={{ uri: resolveUrl(b.cover_url) }} style={styles.bookCover} />
                ) : (
                  <View style={[styles.bookCover, styles.bookCoverPh]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.bookTitle} numberOfLines={2}>{b.title}</Text>
                  <Text style={styles.bookMeta}>
                    {(b.genre || 'Story')} ┬╖ {b.views || 0} views
                  </Text>
                  {b.description ? (
                    <Text style={styles.bookSnippet} numberOfLines={2}>{b.description}</Text>
                  ) : null}
                </View>
                <ChevronRight size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity style={styles.topBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.topBtn} onPress={onShare}>
          <Share2 size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  loadingWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  backInline: { padding: 10 },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: SPACING.md, paddingBottom: 8,
    flexDirection: 'row', alignItems: 'center',
    zIndex: 10,
  },
  topBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },

  scroll: { paddingBottom: 80 },
  coverWrap: { width: '100%', height: 240, position: 'absolute', top: 0, left: 0, right: 0 },
  coverImg: { width: '100%', height: 240 },
  coverPlaceholder: { backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  coverShade: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: 120, backgroundColor: 'rgba(15,15,15,0.9)',
  },
  body: { marginTop: 200, padding: SPACING.lg, backgroundColor: COLORS.background },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  kind: { color: COLORS.accent, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  statusPill: {
    color: COLORS.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 0.6,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  title: { color: COLORS.text, fontFamily: FONTS.display, fontSize: 26, marginBottom: SPACING.xs },

  universeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6,
  },
  universeText: { color: COLORS.textSecondary, fontSize: 12 },

  creatorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: SPACING.md, alignSelf: 'flex-start',
  },
  creatorAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(212,168,67,0.1)',
  },
  creatorAvatarPh: { alignItems: 'center', justifyContent: 'center' },
  creatorName: { color: COLORS.textSecondary, fontSize: 13 },

  desc: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: SPACING.md },

  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 11, borderRadius: 999,
    backgroundColor: COLORS.accent,
  },
  startBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: SPACING.lg },
  sectionTitle: {
    color: COLORS.text, fontFamily: FONTS.display, fontSize: 16,
    marginBottom: SPACING.sm,
  },

  empty: {
    flexDirection: 'row', gap: 10, alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(212,168,67,0.06)',
    borderWidth: 1, borderColor: 'rgba(212,168,67,0.18)',
    borderStyle: 'dashed',
  },
  emptyText: { color: COLORS.textSecondary, fontSize: 12, flex: 1 },

  bookRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  bookOrder: {
    width: 22, textAlign: 'center',
    color: COLORS.accent, fontWeight: '800', fontSize: 14,
  },
  bookCover: {
    width: 56, height: 80,
    borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.04)',
  },
  bookCoverPh: {},
  bookTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  bookMeta: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  bookSnippet: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 16 },
});

export default SeriesDetailScreen;