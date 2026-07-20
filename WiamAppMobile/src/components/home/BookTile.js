/**
 * BookTile — atomic cover tile used by every home rail.
 *
 * Designed for Push 5: the home page now shows many small, dense covers
 * (instead of a few oversized ones) so the user can scan more stories per
 * scroll. There are three sizes:
 *
 *   - lg : Spotlight hero (147 wide). Title + meta below.
 *   - md : Pulse / generic. Title below.
 *   - sm : Stream + stacked Pulse children. Title below, tighter.
 *
 * Each tile records a `home_click` analytics event before it navigates,
 * passing the `section` it belongs to and the position within that rail.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import CachedImage from '../common/CachedImage';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import resolveUrl from '../../utils/resolveUrl';
import formatNumber from '../../utils/formatNumber';
import trackingApi from '../../api/tracking';
import { Eye, Star } from 'lucide-react-native';

const SIZES = {
  lg: { cover: 156, ratio: 1.45, title: 14, meta: 11 },
  md: { cover: 96, ratio: 1.5, title: 12, meta: 10 },
  sm: { cover: 78, ratio: 1.5, title: 11, meta: 9 },
};

const BookTile = ({
  book,
  size = 'md',
  section,
  position = 0,
  onPress,
  showStats = true,
  style,
}) => {
  if (!book || !book.id) return null;
  const cfg = SIZES[size] || SIZES.md;
  const w = cfg.cover;
  const h = w * cfg.ratio;

  const handlePress = () => {
    if (typeof book.id === 'number') {
      trackingApi.homeClick(section || 'unknown', book.id, position);
    }
    if (onPress) onPress(book);
  };

  const cover = book.cover_url ? (
    <CachedImage
      source={{ uri: resolveUrl(book.cover_url) }}
      style={[styles.cover, { width: w, height: h, borderRadius: size === 'lg' ? 14 : 10 }]}
    />
  ) : (
    <View
      style={[
        styles.cover,
        styles.placeholder,
        { width: w, height: h, borderRadius: size === 'lg' ? 14 : 10 },
      ]}
    >
      <Text style={styles.placeholderText} numberOfLines={2}>
        {book.title}
      </Text>
    </View>
  );

  return (
    <Pressable onPress={handlePress} style={[{ width: w }, style]}>
      <View>
        {cover}
        {showStats && (book.views || book.rating) ? (
          <View style={styles.statBadge}>
            {book.views ? (
              <View style={styles.statRow}>
                <Eye size={9} color="#fde68a" />
                <Text style={styles.statText}>{formatNumber(book.views)}</Text>
              </View>
            ) : null}
            {book.rating && book.rating > 0 ? (
              <View style={[styles.statRow, { marginLeft: 4 }]}>
                <Star size={9} color="#fde68a" fill="#fde68a" />
                <Text style={styles.statText}>{Number(book.rating).toFixed(1)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      <Text style={[styles.title, { fontSize: cfg.title }]} numberOfLines={2}>
        {book.title}
      </Text>
      {book.author ? (
        <Text style={[styles.author, { fontSize: cfg.meta }]} numberOfLines={1}>
          {book.author}
        </Text>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  cover: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,20,40,0.85)',
    paddingHorizontal: 6,
  },
  placeholderText: {
    color: COLORS.textMuted,
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '600',
  },
  title: {
    color: COLORS.text,
    fontWeight: '600',
    marginTop: 6,
  },
  author: {
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  statText: {
    color: '#fde68a',
    fontSize: 9,
    fontWeight: '700',
    marginLeft: 2,
  },
});

export default BookTile;
