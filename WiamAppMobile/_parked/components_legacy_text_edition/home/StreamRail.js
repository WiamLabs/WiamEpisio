/**
 * ARCHIVED 2026-07-16 — WiamEpisio Phase 1 (Text Edition park).
 * Do not wire into active navigation. Pending possible future Text Edition.
 * Source: docs/WIAMEPISIO_PHASE1_CLEARING_BLOCKERS.md §3
 */
/**
 * StreamRail ΓÇö fast horizontal stream of small book tiles.
 *
 * Used for the third home pool (the "always something new" rail) plus
 * the "Latest" / "Top Rated" sections. Tiles are intentionally small
 * (78px wide) so a single rail can show 12+ books before the user has
 * to scroll, which matches Push 5's brief: more covers, smaller, no
 * duplicates.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
} from 'react-native';
import { COLORS, FONTS, SPACING } from '../../constants/theme';
import BookTile from './BookTile';
import trackingApi from '../../api/tracking';

const StreamRail = ({
  title,
  subtitle,
  icon,
  books,
  onPressBook,
  sectionKey = 'stream',
  size = 'sm',
  emptyText,
}) => {
  const data = books || [];
  const seen = useRef(new Set()).current;

  useEffect(() => {
    data.slice(0, 6).forEach((b, idx) => {
      if (b && b.id && !seen.has(b.id)) {
        seen.add(b.id);
        trackingApi.queueImpression(sectionKey, b.id, idx);
      }
    });
  }, [data, sectionKey, seen]);

  if (!data.length) {
    if (!emptyText) return null;
    return (
      <View style={styles.wrap}>
        <View style={styles.head}>
          <View style={styles.headLeft}>
            {icon}
            <Text style={styles.headTitle}>{title}</Text>
          </View>
        </View>
        <Text style={styles.empty}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          {icon}
          <Text style={styles.headTitle}>{title}</Text>
        </View>
        {subtitle ? <Text style={styles.headSub}>{subtitle}</Text> : null}
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={data}
        keyExtractor={(item, idx) => `${sectionKey}-${item.id || idx}`}
        renderItem={({ item, index }) => (
          <BookTile
            book={item}
            size={size}
            section={sectionKey}
            position={index}
            onPress={onPressBook}
            style={{ marginRight: SPACING.md }}
          />
        )}
        contentContainerStyle={styles.list}
        removeClippedSubviews
        maxToRenderPerBatch={6}
        initialNumToRender={6}
        windowSize={5}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginTop: SPACING.lg,
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
  list: {
    paddingHorizontal: SPACING.lg,
  },
  empty: {
    color: COLORS.textMuted,
    fontSize: 12,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
});

export default StreamRail;