/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 (Text Edition park).
 * Do not wire into active navigation. Pending possible future Text Edition.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
/**
 * BookCard ΓÇö Reusable book cover card used across Home, Browse, Library, etc.
 *
 * Props:
 *   book        ΓÇö { id, title, author, cover_url, genre, rating, chapter_count }
 *   onPress     ΓÇö Called with book object
 *   size        ΓÇö 'default' | 'small' | 'wide'
 *   showProgress ΓÇö Show reading progress bar (for Library)
 *   progress    ΓÇö { current_chapter, total_chapters }
 *   style       ΓÇö Container style overrides
 */
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { Star } from 'lucide-react-native';

const SIZES = {
  small: { width: 96, height: 144 },
  default: { width: 122, height: 183 },
  wide: { width: 150, height: 225 },
};

const BookCard = ({
  book,
  onPress,
  size = 'default',
  showProgress = false,
  progress,
  style,
}) => {
  const dim = SIZES[size] || SIZES.default;

  return (
    <TouchableOpacity
      style={[styles.container, { width: dim.width }, style]}
      onPress={() => onPress?.(book)}
      activeOpacity={0.7}
    >
      <View style={[styles.coverWrap, { width: dim.width, height: dim.height }]}>
        <Image
          source={{ uri: book.cover_url || 'https://via.placeholder.com/150x225' }}
          style={[styles.cover, { width: dim.width, height: dim.height }]}
          resizeMode="cover"
        />
        {book.rating > 0 && (
          <View style={styles.ratingBadge}>
            <Star size={9} color={COLORS.secondary} fill={COLORS.secondary} />
            <Text style={styles.ratingText}>{book.rating?.toFixed?.(1) || book.rating}</Text>
          </View>
        )}
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {book.title}
      </Text>
      <Text style={styles.author} numberOfLines={1}>
        {book.author || book.creator?.pen_name || ''}
      </Text>

      {showProgress && progress && (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.max(4, Math.min(100, Math.round(
                    (progress.current_chapter / Math.max(progress.total_chapters, 1)) * 100
                  )))}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            Ch {progress.current_chapter}/{progress.total_chapters}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginRight: SPACING.md,
  },
  coverWrap: {
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cover: {
    borderRadius: RADIUS.sm,
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 6,
  },
  author: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  progressWrap: {
    marginTop: 4,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.secondary,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});

export default BookCard;