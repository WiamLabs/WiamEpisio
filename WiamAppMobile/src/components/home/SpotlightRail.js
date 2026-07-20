/**
 * SpotlightRail — the "hero" rail at the top of Home.
 *
 * Displays at most 3 books in a snap-paged horizontal scroll. Each card is
 * a wide hero (cover on the left, title + author + genre + a soft "Spotlight"
 * tag on the right). Tapping a card navigates to BookDetail and records
 * a `home_click` event; an `home_impression` is queued the first time
 * each card becomes visible.
 *
 * Design goals (Push 5):
 *   - Distinct from Pulse / Stream so the same book never feels like
 *     it's repeating across the page.
 *   - Visually anchored at the top so users know "this is today's pick".
 *   - All copy localised through the existing string conventions.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Pressable,
  Animated,
} from 'react-native';
import CachedImage from '../common/CachedImage';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import resolveUrl from '../../utils/resolveUrl';
import formatNumber from '../../utils/formatNumber';
import trackingApi from '../../api/tracking';
import { Sparkles, Eye, Star } from 'lucide-react-native';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.min(SCREEN_W - SPACING.lg * 2, 360);
const CARD_H = 176;

const SpotlightRail = ({ books, onPressBook, sectionKey = 'spotlight' }) => {
  const data = (books || []).slice(0, 3);
  const seen = useRef(new Set()).current;

  useEffect(() => {
    data.forEach((b, idx) => {
      if (b && b.id && !seen.has(b.id)) {
        seen.add(b.id);
        trackingApi.queueImpression(sectionKey, b.id, idx);
      }
    });
  }, [data, sectionKey, seen]);

  if (!data.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <Sparkles size={16} color="#facc15" />
          <Text style={styles.headTitle}>Today&apos;s Spotlight</Text>
        </View>
        <Text style={styles.headSub}>{data.length} hand-picked stories</Text>
      </View>
      <ScrollView
        horizontal
        pagingEnabled
        snapToInterval={CARD_W + SPACING.md}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {data.map((b, idx) => (
          <SpotlightCard
            key={`spotlight-${b.id || idx}`}
            book={b}
            position={idx}
            onPress={() => onPressBook && onPressBook(b)}
            sectionKey={sectionKey}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const SpotlightCard = ({ book, position, onPress, sectionKey }) => {
  const handlePress = () => {
    if (book && typeof book.id === 'number') {
      trackingApi.homeClick(sectionKey, book.id, position);
    }
    if (onPress) onPress();
  };

  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}>
      <View style={styles.coverWrap}>
        {book.cover_url ? (
          <CachedImage source={{ uri: resolveUrl(book.cover_url) }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Text style={styles.placeholderText} numberOfLines={3}>
              {book.title}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.tag}>
          <Sparkles size={10} color="#facc15" />
          <Text style={styles.tagText}>Spotlight</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {book.title}
        </Text>
        {book.author ? (
          <Text style={styles.author} numberOfLines={1}>
            by {book.author}
          </Text>
        ) : null}
        {book.genre ? (
          <Text style={styles.genre} numberOfLines={1}>
            {book.genre}
          </Text>
        ) : null}
        <View style={styles.statsRow}>
          {book.views ? (
            <View style={styles.statChip}>
              <Eye size={11} color="#fde68a" />
              <Text style={styles.statText}>{formatNumber(book.views)}</Text>
            </View>
          ) : null}
          {book.rating && book.rating > 0 ? (
            <View style={styles.statChip}>
              <Star size={11} color="#fde68a" fill="#fde68a" />
              <Text style={styles.statText}>{Number(book.rating).toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  headLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontFamily: FONTS.display,
  },
  headSub: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  scroll: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 18,
    backgroundColor: 'rgba(20, 20, 40, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 67, 0.18)',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  coverWrap: {
    width: 116,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cover: {
    width: 116,
    height: '100%',
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: 'rgba(40,40,70,0.6)',
  },
  placeholderText: {
    color: COLORS.textMuted,
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
  },
  body: {
    flex: 1,
    padding: SPACING.md,
    justifyContent: 'space-between',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: 'rgba(250, 204, 21, 0.12)',
    borderColor: 'rgba(250, 204, 21, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 4,
  },
  tagText: {
    color: '#facc15',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  title: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONTS.displaySemi,
    marginTop: 2,
  },
  author: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  genre: {
    color: COLORS.secondary,
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statText: {
    color: '#fde68a',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default SpotlightRail;
