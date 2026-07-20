/**
 * ContinueRail — "Pick up where you left off" rail.
 *
 * Special-cased home rail (its own renderer because it shows reading
 * progress per book, which generic rails don't). Always pinned at the
 * top of Home V2 when the user has at least one in-progress book.
 *
 * Tracking: each card records a ``home_click`` event with section key
 * ``continue_reading`` before navigating to the Reader at the user's
 * last chapter. No impressions are queued — by definition the user
 * already knows about these books.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import { Clock3 } from 'lucide-react-native';
import CachedImage from '../common/CachedImage';
import resolveUrl from '../../utils/resolveUrl';
import trackingApi from '../../api/tracking';

const ContinueRail = ({ books, navigation, title = 'Pick up where you left off' }) => {
  const data = books || [];
  if (!data.length) return null;

  const handlePress = (item, position) => {
    if (item && typeof item.id === 'number') {
      trackingApi.homeClick('continue_reading', item.id, position);
    }
    const chapter = item.reading_progress?.current_chapter || 1;
    navigation.navigate('Reader', { bookId: item.id, chNum: chapter });
  };

  const renderItem = ({ item, index }) => {
    const chapter = item.reading_progress?.current_chapter || 1;
    const total = item.chapter_count || item.chapters?.length || 1;
    const pct = Math.max(4, Math.min(100, Math.round((chapter / Math.max(total, 1)) * 100)));
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handlePress(item, index)}
      >
        {item.cover_url ? (
          <CachedImage source={{ uri: resolveUrl(item.cover_url) }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]} />
        )}
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.meta}>
          Ch. {chapter}/{total}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <Clock3 size={16} color={COLORS.secondary} />
          <Text style={styles.headTitle}>{title}</Text>
        </View>
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={data}
        renderItem={renderItem}
        keyExtractor={(item, idx) => `continue-${item.id || idx}`}
        contentContainerStyle={styles.list}
        removeClippedSubviews
        maxToRenderPerBatch={4}
        initialNumToRender={3}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginTop: SPACING.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
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
  list: {
    paddingHorizontal: SPACING.lg,
  },
  card: {
    width: 132,
    marginRight: SPACING.md,
  },
  cover: {
    width: 132,
    height: 188,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  coverPlaceholder: {
    backgroundColor: 'rgba(20,20,40,0.85)',
  },
  title: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.secondary,
  },
  meta: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
});

export default ContinueRail;
