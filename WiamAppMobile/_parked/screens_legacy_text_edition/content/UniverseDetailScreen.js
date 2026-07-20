/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 (Text Edition park).
 * Do not wire into active navigation. Pending possible future Text Edition.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
/**
 * UniverseDetailScreen ΓÇö public reader page (Push 10).
 *
 * Reads /api/v1/universes/<id>/public so any reader (including guests)
 * can see what's inside a universe: linked series with sample books and
 * a creator strip. Tapping a series opens SeriesDetail; tapping a book
 * opens BookDetail.
 *
 * Visual style stays in WiamApp wine/gold (this is the reader-side, not
 * Studio-side) so it doesn't feel out of place from the Home screen.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  RefreshControl, ActivityIndicator, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Layers, Globe, ChevronRight, Share2,
} from 'lucide-react-native';
import CachedImage from '../../components/common/CachedImage';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import resolveUrl from '../../utils/resolveUrl';
import studioV2Api from '../../api/studioV2';

const UniverseDetailScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { universeId } = route.params || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await studioV2Api.getUniversePublic(universeId);
      setData(res);
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Could not load this universe.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [universeId]);

  useEffect(() => { load(); }, [load]);

  const onShare = async () => {
    if (!data?.universe) return;
    try {
      await Share.share({
        message: `Check out "${data.universe.title}" on WiamApp`,
        url: `https://wiamapp.com/universe/${data.universe.id}`,
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

  if (error || !data?.universe) {
    return (
      <View style={[styles.loadingWrap, { paddingTop: insets.top }]}>
        <Text style={{ color: COLORS.textMuted, marginBottom: 12 }}>
          {error || 'Universe not found.'}
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backInline}>
          <Text style={{ color: COLORS.accent, fontWeight: '700' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const u = data.universe;
  const series = data.series || [];
  const creator = data.creator;

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
        {/* Cover hero */}
        <View style={styles.coverWrap}>
          {u.cover_url ? (
            <CachedImage source={{ uri: resolveUrl(u.cover_url) }} style={styles.coverImg} />
          ) : (
            <View style={[styles.coverImg, styles.coverPlaceholder]}>
              <Globe size={48} color="rgba(255,255,255,0.2)" />
            </View>
          )}
          <View style={styles.coverShade} />
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Globe size={14} color={COLORS.accent} />
            <Text style={styles.kind}>UNIVERSE</Text>
          </View>
          <Text style={styles.title}>{u.title}</Text>

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

          {u.description ? (
            <Text style={styles.desc}>{u.description}</Text>
          ) : null}

          <View style={styles.statsRow}>
            <Stat label="Series" value={series.length} />
            <Stat label="Visibility" value={u.visibility || 'public'} />
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Series in this universe</Text>

          {series.length === 0 ? (
            <View style={styles.empty}>
              <Layers size={20} color={COLORS.accent} />
              <Text style={styles.emptyText}>No public series here yet ΓÇö check back soon.</Text>
            </View>
          ) : (
            series.map((s) => (
              <TouchableOpacity
                key={`s-${s.id}`}
                style={styles.seriesCard}
                onPress={() => navigation.navigate('SeriesDetail', { seriesId: s.id })}
              >
                <View style={styles.seriesHead}>
                  <View style={styles.seriesIconWrap}>
                    <Layers size={14} color={COLORS.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.seriesTitle} numberOfLines={1}>{s.title}</Text>
                    <Text style={styles.seriesMeta}>
                      {(s.book_count || s.sample_books?.length || 0)} books ┬╖ {s.status || 'ongoing'}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={COLORS.textMuted} />
                </View>
                {(s.sample_books || []).length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 10, marginTop: 10 }}
                  >
                    {s.sample_books.map((b) => (
                      <TouchableOpacity
                        key={`sb-${s.id}-${b.id}`}
                        onPress={() => navigation.navigate('BookDetail', { bookId: b.id })}
                        style={styles.miniBook}
                      >
                        {b.cover_url ? (
                          <CachedImage source={{ uri: resolveUrl(b.cover_url) }} style={styles.miniBookCover} />
                        ) : (
                          <View style={[styles.miniBookCover, styles.miniBookCoverPh]} />
                        )}
                        <Text style={styles.miniBookTitle} numberOfLines={2}>{b.title}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : null}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Top bar (overlays) */}
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

const Stat = ({ label, value }) => (
  <View style={styles.stat}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  loadingWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  backInline: { padding: 10 },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: SPACING.md,
    paddingBottom: 8,
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
  coverPlaceholder: {
    backgroundColor: '#222',
    alignItems: 'center', justifyContent: 'center',
  },
  coverShade: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: 120, backgroundColor: 'rgba(15,15,15,0.9)',
  },
  body: { marginTop: 200, padding: SPACING.lg, backgroundColor: COLORS.background },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  kind: { color: COLORS.accent, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  title: { color: COLORS.text, fontFamily: FONTS.display, fontSize: 28, marginBottom: SPACING.sm },

  creatorRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: SPACING.md, alignSelf: 'flex-start',
  },
  creatorAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(212,168,67,0.1)',
  },
  creatorAvatarPh: { alignItems: 'center', justifyContent: 'center' },
  creatorName: { color: COLORS.textSecondary, fontSize: 13 },

  desc: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: SPACING.md },

  statsRow: { flexDirection: 'row', gap: SPACING.lg, marginBottom: SPACING.md },
  stat: {},
  statValue: { color: COLORS.text, fontSize: 18, fontFamily: FONTS.displaySemi },
  statLabel: { color: COLORS.textMuted, fontSize: 11, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: SPACING.md },
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

  seriesCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  seriesHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  seriesIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(212,168,67,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  seriesTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  seriesMeta: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },

  miniBook: { width: 80 },
  miniBookCover: {
    width: 80, height: 110,
    borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.04)',
  },
  miniBookCoverPh: {},
  miniBookTitle: { color: COLORS.textSecondary, fontSize: 11, marginTop: 4 },
});

export default UniverseDetailScreen;